export interface TenantFormData {
  name: string;
  slug: string;
  email: string;
  phone?: string;
  commissionRate: number;
  stripeAccountId?: string;
  isActive: boolean;
}

export interface TenantFormErrors {
  [key: string]: string;
}
