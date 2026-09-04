import { PermissionKey, UserRole } from '../types.js';

export interface PermissionItem {
  id: PermissionKey;
  name: string;
  desc: string;
}

export interface PermissionGroup {
  name: 'Operational Hub' | 'Content CMS' | 'Core Module' | 'System & Staff' | 'Finance & Payments' | 'Customer Management' | 'About & Website Settings' | 'System Settings & Audit';
  description: string;
  permissions: PermissionItem[];
}

export const MODULE_PERMISSIONS: PermissionGroup[] = [
  {
    name: 'Operational Hub',
    description: 'Order management, queue processing, document uploads, and customer support tickets',
    permissions: [
      { id: 'dashboard.view', name: 'View Dashboard Analytics', desc: 'Access analytics and high-level order stats' },
      { id: 'orders.view', name: 'View All Orders', desc: 'Access global order directory' },
      { id: 'orders.view_assigned', name: 'View Assigned Orders Only', desc: 'Access orders assigned to current staff' },
      { id: 'orders.assign', name: 'Assign Orders to Employees', desc: 'Assign/reassign processing officers to orders' },
      { id: 'orders.update', name: 'Update Order Status & Notes', desc: 'Transition order state, add comments' },
      { id: 'documents.verify', name: 'Verify Customer Documents', desc: 'Approve or request document re-upload' },
      { id: 'documents.upload', name: 'Upload Final Processed Documents', desc: 'Attach completed service output files' },
      { id: 'whatsapp_delivery.update', name: 'WhatsApp Delivery Management', desc: 'Trigger automated WhatsApp notification dispatches' },
      { id: 'support.manage', name: 'Manage Support Tickets', desc: 'View and respond to customer helpdesk tickets' },
    ]
  },
  {
    name: 'Content CMS',
    description: 'Blogging, legal pages, promotional banners, and media library assets',
    permissions: [
      { id: 'blogs.view', name: 'View Blogs', desc: 'Read news and blog articles' },
      { id: 'blogs.manage', name: 'Manage Blogs', desc: 'Create, edit, publish and delete blog posts' },
      { id: 'reviews.manage', name: 'Manage Customer Reviews', desc: 'Approve, reject, hide, or delete customer reviews & ratings' },
      { id: 'pages.manage', name: 'Manage Custom Pages', desc: 'Edit legal, terms, and custom CMS pages' },
      { id: 'banners.manage', name: 'Manage Homepage Banners', desc: 'Configure promotional carousels and sliders' },
      { id: 'media.manage', name: 'Manage Media Library', desc: 'Upload, delete, and organize media assets' },
    ]
  },
  {
    name: 'Core Module',
    description: 'Services catalog, pricing structures, categories, and organizational master data',
    permissions: [
      { id: 'services.view', name: 'View Services Catalog', desc: 'Access list of services and fees' },
      { id: 'services.manage', name: 'Manage Services & Pricing', desc: 'Add, update, duplicate, or remove services' },
      { id: 'categories.manage', name: 'Manage Service Categories', desc: 'Create and organize service categories' },
      { id: 'master_data.view', name: 'View Master Data', desc: 'Access departments and designations lists' },
      { id: 'master_data.manage', name: 'Manage Master Data', desc: 'Add/edit departments and job designations' },
    ]
  },
  {
    name: 'System & Staff',
    description: 'Employee directory, identity KYC validation, confidential payroll, and staff credentials',
    permissions: [
      { id: 'employees.view', name: 'View Employee Directory', desc: 'Read operational employee profiles' },
      { id: 'employees.manage', name: 'Manage Employee Directory', desc: 'Add or update employee operational data' },
      { id: 'employee_kyc.view', name: 'View Employee KYC Data', desc: 'Access Aadhaar/PAN verification records' },
      { id: 'employee_kyc.manage', name: 'Manage Employee KYC Data', desc: 'Verify and approve employee identity KYC' },
      { id: 'employee_payroll.view', name: 'View Employee Payroll Data', desc: 'Access confidential bank and salary data' },
      { id: 'employee_payroll.manage', name: 'Manage Employee Payroll Data', desc: 'Update bank accounts and salary structures' },
      { id: 'staff_accounts.view', name: 'View Staff Accounts', desc: 'List staff system accounts' },
      { id: 'staff_accounts.manage', name: 'Manage Staff System Accounts', desc: 'Grant system access, reset passwords' },
      { id: 'roles.view', name: 'View Roles & Permissions', desc: 'Read permission definitions and roles matrix' },
      { id: 'roles.manage', name: 'Manage Roles & Permissions', desc: 'Create or modify custom roles and access control' },
    ]
  },
  {
    name: 'Finance & Payments',
    description: 'Customer payment verifications, bank instructions, and gateway settings',
    permissions: [
      { id: 'payments.view', name: 'View Payment Transactions', desc: 'Inspect customer UTR and payment proofs' },
      { id: 'payments.verify', name: 'Verify & Approve Payments', desc: 'Approve or reject customer payment receipts' },
      { id: 'payment_settings.manage', name: 'Manage Payment Gateway Settings', desc: 'Configure UPI IDs, QR codes, and bank accounts' },
    ]
  },
  {
    name: 'Customer Management',
    description: 'Customer directory, verification badges, and account status management',
    permissions: [
      { id: 'customers.view', name: 'View Customer Directory', desc: 'Search and inspect registered customer accounts' },
      { id: 'customers.manage', name: 'Manage Customer Accounts', desc: 'Suspend or update customer account details' },
    ]
  },
  {
    name: 'About & Website Settings',
    description: 'Organization overview, vision, leadership team, and contact information',
    permissions: [
      { id: 'about.view', name: 'View About Us Info', desc: 'Read organizational bio and team stats' },
      { id: 'about.manage', name: 'Manage About Us Content', desc: 'Update founder info, vision, and team stats' },
      { id: 'contact_settings.manage', name: 'Manage Contact Settings', desc: 'Update support emails, hotlines, and location' },
    ]
  },
  {
    name: 'System Settings & Audit',
    description: 'Global system variables, security keys, and security audit logs',
    permissions: [
      { id: 'system_settings.view', name: 'View System Settings', desc: 'Inspect global environment settings' },
      { id: 'system_settings.manage', name: 'Manage System Settings', desc: 'Update security keys, maintenance state' },
      { id: 'audit_logs.view', name: 'View Security Audit Logs', desc: 'Access comprehensive activity and security logs' },
    ]
  }
];

const LEGACY_PERMISSIONS_MAP: Record<string, string[]> = {
  'view_analytics': ['dashboard.view', 'dashboard.metrics'],
  'manage_orders': ['orders.view', 'orders.view_assigned', 'orders.update', 'documents.verify', 'documents.upload'],
  'create_service': ['services.view', 'services.manage'],
  'edit_service': ['services.view', 'services.manage'],
  'delete_service': ['services.manage'],
  'publish_blog': ['blogs.view', 'blogs.manage'],
  'manage_users': ['customers.view', 'customers.manage', 'staff_accounts.view', 'staff_accounts.manage'],
  'manage_payments': ['payments.view', 'payments.verify', 'payment_settings.manage'],
  'manage_settings': ['system_settings.view', 'system_settings.manage'],
};

export function hasUserPermission(
  user: { role?: string | UserRole; permissions?: string[] } | null | undefined,
  requiredPermission: PermissionKey | PermissionKey[] | string | string[]
): boolean {
  if (!user) return false;

  const roleStr = String(user.role);
  // ADMIN role automatically has access to everything
  if (roleStr === UserRole.ADMIN || roleStr === 'ADMIN' || roleStr === 'SUPER_ADMIN') {
    return true;
  }

  const keys = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
  const rawPerms: string[] = Array.isArray(user.permissions) ? user.permissions : [];

  const expandedPerms = new Set<string>();
  for (const p of rawPerms) {
    if (LEGACY_PERMISSIONS_MAP[p]) {
      LEGACY_PERMISSIONS_MAP[p].forEach(mapped => expandedPerms.add(mapped));
    } else {
      expandedPerms.add(p);
    }
  }

  return keys.some(key => expandedPerms.has(key));
}

export const TAB_PERMISSIONS_MAP: Record<string, PermissionKey | PermissionKey[]> = {
  analytics: 'dashboard.view',
  orders: ['orders.view', 'orders.view_assigned'],
  services: ['services.view', 'services.manage'],
  category_management: ['categories.manage', 'services.manage', 'blogs.manage'],
  blogs: ['blogs.view', 'blogs.manage'],
  faqs: 'pages.manage',
  banners: 'banners.manage',
  pages: 'pages.manage',
  media: 'media.manage',
  about_us: ['about.view', 'about.manage'],
  contact_us: 'contact_settings.manage',
  payment_settings: ['payment_settings.manage', 'payments.view'],
  admin_settings: ['system_settings.view', 'system_settings.manage'],
  notifications: 'whatsapp_delivery.update',
  employee_records: ['employees.view', 'employees.manage'],
  users: ['staff_accounts.view', 'staff_accounts.manage', 'customers.view', 'customers.manage'],
  roles_management: ['roles.view', 'roles.manage'],
  audit: 'audit_logs.view'
};
