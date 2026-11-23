export const ROLES = ['admin', 'manager', 'receptionist', 'technician'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  manager: 'Branch Manager',
  receptionist: 'Receptionist',
  technician: 'Lab Technician',
}

export type Permission =
  | 'dashboard'
  | 'orders.create'
  | 'labqueue'
  | 'orders.view'
  | 'templates'
  | 'categories'
  | 'sales'
  | 'doctors'
  | 'partners'
  | 'patients'
  | 'staff'
  | 'branches.manage'
  | 'branches.switch'

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'dashboard',
    'orders.create',
    'labqueue',
    'orders.view',
    'templates',
    'categories',
    'sales',
    'doctors',
    'partners',
    'patients',
    'staff',
    'branches.manage',
    'branches.switch',
  ],
  manager: [
    'dashboard',
    'orders.create',
    'labqueue',
    'orders.view',
    'templates',
    'categories',
    'sales',
    'doctors',
    'partners',
    'patients',
    'branches.switch',
  ],
  receptionist: [
    'dashboard',
    'orders.create',
    'orders.view',
    'templates',
    'sales',
    'doctors',
    'patients',
  ],
  technician: ['dashboard', 'labqueue', 'orders.view', 'partners', 'patients'],
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value)
}

export function can(role: string, permission: Permission) {
  return isRole(role) && ROLE_PERMISSIONS[role].includes(permission)
}

export const NAV_ITEMS: { href: string; label: string; permission: Permission }[] = [
  { href: '/', label: 'Dashboard', permission: 'dashboard' },
  { href: '/orders/new', label: 'New Order', permission: 'orders.create' },
  { href: '/lab-queue', label: 'Lab Queue', permission: 'labqueue' },
  { href: '/orders', label: 'All Orders', permission: 'orders.view' },
  { href: '/templates', label: 'Templates', permission: 'templates' },
  { href: '/categories', label: 'Test Categories', permission: 'categories' },
  { href: '/sales', label: 'Sales', permission: 'sales' },
  { href: '/doctors', label: 'Doctors', permission: 'doctors' },
  { href: '/partners', label: 'Lab Partners', permission: 'partners' },
  { href: '/patients', label: 'Patients', permission: 'patients' },
  { href: '/staff', label: 'Staff', permission: 'staff' },
  { href: '/branches', label: 'Branches', permission: 'branches.manage' },
]

export const ITEM_STATUSES = [
  'pending',
  'sample_collected',
  'processing',
  'outsourced',
  'completed',
] as const
export type ItemStatus = (typeof ITEM_STATUSES)[number]

export const ITEM_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  sample_collected: 'Sample Collected',
  processing: 'Processing',
  outsourced: 'Outsourced',
  completed: 'Completed',
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'online'] as const
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
  online: 'Online',
}
