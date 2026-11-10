import { Customer, EntityStatus } from '../types';
import { storage } from '../utils/storage';

export const customerService = {
  canManage(): boolean { return storage.getCurrentUser()?.role === 'ADMIN'; },
  getAll(): Customer[] {
    return storage.getCustomers();
  },

  getActive(): Customer[] {
    return storage.getCustomers().filter((c) => c.status === 'Active');
  },

  getById(id: string): Customer | undefined {
    return storage.getCustomers().find((c) => c.id === id);
  },

  create(data: {
    name: string;
    email: string;
    mobile: string;
    city: string;
    status: EntityStatus;
  }): { success: boolean; customer?: Customer; error?: string } {
    if (!this.canManage()) return { success: false, error: 'Admin permission required.' };
    const customers = storage.getCustomers();

    // Check unique email
    const emailExists = customers.some(
      (c) => c.email.toLowerCase() === data.email.trim().toLowerCase()
    );
    if (emailExists) {
      return { success: false, error: 'A customer with this email address already exists.' };
    }

    // Generate ID: CUST-009, CUST-010 etc
    const maxNum = customers.reduce((max, c) => {
      const match = c.id.match(/CUST-(\d+)/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    const newId = `CUST-${String(maxNum + 1).padStart(3, '0')}`;

    const newCustomer: Customer = {
      id: newId,
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      mobile: data.mobile.trim(),
      city: data.city.trim(),
      status: data.status,
      createdAt: new Date().toISOString(),
    };

    storage.setCustomers([newCustomer, ...customers]);
    return { success: true, customer: newCustomer };
  },

  update(
    id: string,
    data: Partial<Omit<Customer, 'id' | 'createdAt'>>
  ): { success: boolean; customer?: Customer; error?: string } {
    if (!this.canManage()) return { success: false, error: 'Admin permission required.' };
    const customers = storage.getCustomers();
    const index = customers.findIndex((c) => c.id === id);

    if (index === -1) {
      return { success: false, error: 'Customer not found.' };
    }

    // Check email uniqueness if email updated
    if (data.email) {
      const emailConflict = customers.some(
        (c) => c.id !== id && c.email.toLowerCase() === data.email!.trim().toLowerCase()
      );
      if (emailConflict) {
        return { success: false, error: 'Another customer is already using this email address.' };
      }
    }

    const updated: Customer = {
      ...customers[index],
      ...data,
      name: data.name ? data.name.trim() : customers[index].name,
      email: data.email ? data.email.trim().toLowerCase() : customers[index].email,
      mobile: data.mobile ? data.mobile.trim() : customers[index].mobile,
      city: data.city ? data.city.trim() : customers[index].city,
      updatedAt: new Date().toISOString(),
    };

    customers[index] = updated;
    storage.setCustomers([...customers]);
    return { success: true, customer: updated };
  },

  delete(id: string): { success: boolean; error?: string } {
    if (!this.canManage()) return { success: false, error: 'Admin permission required.' };
    const orders = storage.getOrders();
    const isReferenced = orders.some((o) => o.customerId === id);

    if (isReferenced) {
      return {
        success: false,
        error:
          'Cannot delete customer: This customer is referenced by one or more existing sales orders. You may change their status to "Inactive" instead.',
      };
    }

    const customers = storage.getCustomers();
    const filtered = customers.filter((c) => c.id !== id);
    if (filtered.length === customers.length) {
      return { success: false, error: 'Customer not found.' };
    }

    storage.setCustomers(filtered);
    return { success: true };
  },

  toggleStatus(id: string): { success: boolean; newStatus?: EntityStatus; error?: string } {
    if (!this.canManage()) return { success: false, error: 'Admin permission required.' };
    const customer = this.getById(id);
    if (!customer) return { success: false, error: 'Customer not found.' };
    const nextStatus: EntityStatus = customer.status === 'Active' ? 'Inactive' : 'Active';
    const res = this.update(id, { status: nextStatus });
    return { success: res.success, newStatus: nextStatus, error: res.error };
  },
};
