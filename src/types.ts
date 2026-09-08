export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN'
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  category: 'Government Form' | 'Admission' | 'Exam' | 'Document Deadline' | 'Scholarship' | 'Recruitment' | 'Service Deadline';
  description: string;
  link?: string;
  status: 'active' | 'expired';
  createdAt?: string;
}

export enum OrderStatus {
  PENDING = 'Pending',
  DOCUMENTS_REQUIRED = 'Documents Required',
  UNDER_VERIFICATION = 'Under Verification',
  PROCESSING = 'Processing',
  COMPLETED = 'Completed',
  REJECTED = 'Rejected'
}

export enum PaymentMethod {
  UPI = 'UPI',
  QR = 'QR Code',
  BANK_TRANSFER = 'Bank Transfer'
}

export enum PaymentStatus {
  PENDING_VERIFICATION = 'Pending Verification',
  VERIFIED = 'Verified',
  REJECTED = 'Rejected'
}

export type DocumentDeliveryStatus = 'Pending' | 'Ready' | 'SENT_VIA_WHATSAPP';

export interface MasterData {
  departments: string[];
  designations: string[];
  employmentTypes?: string[];
  workLocations?: string[];
  employeeStatuses?: string[];
  documentTypes?: string[];
  banks?: string[];
}

export interface StructuredAddress {
  country?: string;
  state?: string;
  district?: string;
  city?: string;
  addressLine1?: string;
  addressLine2?: string;
  locality?: string;
  landmark?: string;
  pincode?: string;
  pinCode?: string;
  address?: string;
}

export interface CustomerRecord {
  id: string;
  code: string;
  userId?: string;
  name: string;
  customerType: 'Individual' | 'Business / Corporate' | 'Franchise / Partner';
  contactPersonName?: string;
  gender?: string;
  dobOrIncorporationDate?: string;
  photoUrl?: string;
  email: string;
  mobile: string;
  whatsappMobile?: string;
  country?: string;
  state?: string;
  district?: string;
  city?: string;
  addressLine1?: string;
  addressLine2?: string;
  locality?: string;
  landmark?: string;
  pincode?: string;
  pinCode?: string;
  address?: string;
  status: 'Active' | 'Inactive' | 'Blocked';
  gstin?: string;
  panNumber?: string;
  msmeLicense?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompanyProfile {
  companyName: string;
  logoUrl?: string;
  address?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  authorizedSignatoryName?: string;
  authorizedSignatoryDesignation?: string;
}

export type SupportedSocialPlatform =
  | 'facebook'
  | 'instagram'
  | 'whatsapp'
  | 'youtube'
  | 'telegram'
  | 'twitter'
  | 'linkedin';

export interface SocialMediaLink {
  platform: SupportedSocialPlatform | string;
  url: string;
  enabled: boolean;
}

export interface EmployeeRecord {
  id: string;
  name: string;
  designation: string;
  department: string;
  photo?: string;
  photoUrl?: string;
  joiningDate?: string;
  qualification?: string;
  experience?: number;
  employeeId?: string;
  mobile?: string;
  email?: string;
  address?: string;
  status: 'Active' | 'Inactive';
  internalNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeeProfile {
  id: string;
  employeeCode: string;
  fullName: string;
  profilePhoto?: string;
  profilePhotoMediaId?: string;
  fatherName?: string;
  motherName?: string;
  spouseName?: string;
  fatherMotherSpouseName?: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  bloodGroup?: string;
  personalEmail?: string;
  personalMobile?: string;
  emergencyContactName?: string;
  emergencyContactRelation?: string;
  emergencyContactMobile?: string;
  currentAddress?: string;
  permanentAddress?: string;
  isPermanentSameAsCurrent?: boolean;
  country?: string;
  addressLine1?: string;
  addressLine2?: string;
  locality?: string;
  landmark?: string;
  city?: string;
  district?: string;
  state?: string;
  pinCode?: string;
  pincode?: string;
  designation: string;
  department: string;
  employmentType: 'Full-Time' | 'Part-Time' | 'Contract' | 'Intern' | 'Consultant';
  joiningDate: string;
  employmentStatus: 'Active' | 'On Leave' | 'Suspended' | 'Resigned' | 'Terminated';
  reportingManager?: string;
  workLocation?: string;
  probationStatus?: string;
  confirmationDate?: string;
  exitDate?: string;
  exitReason?: string;
  highestQualification?: string;
  qualificationSummary?: string;
  university?: string;
  certifications?: string;
  totalExperienceYears?: number;
  previousOrganizations?: string;
  skills?: string[];
  languages?: string[];
  internalNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeKYC {
  employeeId: string;
  aadhaarNumber?: string; // Masked: XXXX-XXXX-1234
  panNumber?: string;     // Masked: XXXXX1234X
  otherGovernmentIdType?: string;
  otherGovernmentIdNumber?: string;
  aadhaarVerificationStatus?: 'Pending' | 'Verified' | 'Rejected';
  panVerificationStatus?: 'Pending' | 'Verified' | 'Rejected';
  verificationNotes?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  updatedAt?: string;
}

export interface EmployeePayroll {
  employeeId: string;
  accountHolderName?: string;
  bankName?: string;
  branchName?: string;
  accountNumber?: string; // Masked: XXXX XXXX 1234
  ifscCode?: string;
  paymentMethod?: 'Bank Transfer' | 'Cheque' | 'UPI' | 'Cash';
  salaryType?: 'Monthly' | 'Hourly' | 'Contract';
  salaryAmount?: number;
  salaryFrequency?: string;
  effectiveFrom?: string;
  basicPay?: number;
  hra?: number;
  specialAllowance?: number;
  pfDeduction?: number;
  taxDeduction?: number;
  grossSalary?: number;
  netSalary?: number;
  payrollNotes?: string;
  updatedAt?: string;
}

export interface EmployeeAccount {
  employeeId: string;
  userId?: string;
  systemEmail: string;
  username?: string;
  role: UserRole | string;
  permissions?: string[];
  accountStatus: 'Active' | 'Inactive' | 'Locked';
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  documentType: string;
  documentName: string;
  originalFileName: string;
  privateFileKey: string;
  mimeType: string;
  fileSize: string;
  sizeBytes?: number;
  downloadUrl?: string;
  storagePath?: string;
  uploadedBy: string;
  uploadedAt: string;
  verificationStatus: 'Pending' | 'Verified' | 'Rejected';
  verifiedBy?: string;
  verifiedAt?: string;
  notes?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  actionType: string;
  employeeId?: string;
  documentId?: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  description: string;
}

export interface AggregateTeamInfo {
  employeeCount: number;
  trainedEmployeeCount: number;
  combinedExperienceYears: number;
  description: string;
}

export interface AboutUsInfo {
  aboutDescription: string;
  vision: string;
  whyChooseUs: string[];
  founderName: string;
  founderDesignation: string;
  founderPhotoUrl?: string;
  founderBio: string;
  teamStats: AggregateTeamInfo;
  serviceAreas: string[];
  contactSummary: string;
}

export interface PaymentConfig {
  upiId: string;
  upiName: string;
  qrCodeUrl: string;
  bankAccountName: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
  paymentInstructions: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  mobile?: string;
  role: UserRole;
  permissions?: string[];
  isSuspended?: boolean;
  employeeId?: string;
  createdAt: string;
}

export type PermissionKey =
  | 'dashboard.view'
  | 'orders.view'
  | 'orders.view_assigned'
  | 'orders.assign'
  | 'orders.update'
  | 'documents.verify'
  | 'documents.upload'
  | 'whatsapp_delivery.update'
  | 'support.manage'
  | 'blogs.view'
  | 'blogs.manage'
  | 'reviews.manage'
  | 'pages.manage'
  | 'banners.manage'
  | 'media.manage'
  | 'services.view'
  | 'services.manage'
  | 'categories.manage'
  | 'master_data.view'
  | 'master_data.manage'
  | 'employees.view'
  | 'employees.manage'
  | 'employee_kyc.view'
  | 'employee_kyc.manage'
  | 'employee_payroll.view'
  | 'employee_payroll.manage'
  | 'staff_accounts.view'
  | 'staff_accounts.manage'
  | 'roles.view'
  | 'roles.manage'
  | 'payments.view'
  | 'payments.verify'
  | 'payment_settings.manage'
  | 'customers.view'
  | 'customers.manage'
  | 'about.view'
  | 'about.manage'
  | 'contact_settings.manage'
  | 'system_settings.view'
  | 'system_settings.manage'
  | 'audit_logs.view';

export interface PermissionDefinition {
  id: string;
  name: string;
  group: string;
  description?: string;
}

export interface RoleDefinition {
  id: string;
  name: string;
  permissions: string[];
  description?: string;
  isSystemRole?: boolean;
}

export interface ServiceCategory {
  id: string;
  name: string;
  slug?: string;
  icon?: string; // Lucide icon name
  description?: string;
  color?: string;
  sortOrder?: number;
  status?: 'Active' | 'Inactive';
  serviceCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface BlogCategory {
  id: string;
  name: string;
  slug?: string;
  icon?: string; // Lucide icon name
  description?: string;
  color?: string;
  sortOrder?: number;
  status?: 'Active' | 'Inactive';
  blogCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface ServiceTimeline {
  enabled: boolean;
  startDate: string | null;
  endDate: string | null;
}

export interface Service {
  id: string;
  categoryId: string;
  subCategory?: string;
  title: string;
  description: string;
  shortDescription?: string;
  fullDescription?: string;
  timeline?: ServiceTimeline;
  bannerImage?: string;
  imageUrl?: string;
  image?: string;
  icon?: string;
  gallery?: string[];
  requiredDocuments: string[];
  highlights?: string[];
  eligibility: string;
  processingTime: string;
  estimatedTime?: string;
  govFees: number;
  serviceCharge: number;
  faqs: FAQItem[];
  howItWorks?: string;
  seoTitle?: string;
  seoDescription?: string;
  slug?: string;
  status?: string; // e.g. active, inactive, draft, published
  whatsAppEnabled?: boolean;
  featured?: boolean;
  popular?: boolean;
  displayOrder?: number;
  popularity: number; // For trending
}

export interface OrderLog {
  status: OrderStatus;
  comment: string;
  timestamp: string;
}

export interface UploadedDocument {
  id?: string;
  name: string;
  url: string;
  uploadedAt: string;
  type?: string;
  verificationStatus?: 'Pending' | 'Verified' | 'Rejected';
  rejectionReason?: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface Order {
  id: string;
  userId: string;
  customerId?: string;
  orderSource?: 'WhatsApp' | 'Website' | 'Phone' | 'In-Person' | 'Other';
  createdBy?: string;
  createdByName?: string;
  createdByUserRole?: string;
  sourceReference?: string;
  serviceId: string;
  serviceTitle: string;
  category?: string;
  name: string;
  mobile: string;
  email: string;
  country?: string;
  address: string;
  addressLine1?: string;
  addressLine2?: string;
  locality?: string;
  landmark?: string;
  city: string;
  district?: string;
  state: string;
  pinCode: string;
  pincode?: string;
  uploadedDocuments: UploadedDocument[];
  additionalNotes?: string;
  submittedData?: Record<string, any>;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  utr?: string;
  paymentScreenshot?: string;
  paymentDate?: string;
  rejectionReason?: string;
  orderStatus: OrderStatus;
  status?: OrderStatus | string;
  documentDeliveryStatus?: DocumentDeliveryStatus;
  finalDocumentUrl?: string;
  finalDocumentName?: string;
  finalDocumentUploadedAt?: string;
  whatsAppSentAt?: string;
  whatsAppDeliveryNotes?: string;
  totalAmount: number;
  createdAt: string;
  updatedAt?: string;
  priority?: 'Normal' | 'High' | 'Urgent';
  
  // Employee Order Assignment
  assignedEmployeeId?: string;
  assignedUserId?: string;
  assignedEmployeeName?: string;
  assignedEmployeeCode?: string;
  assignedEmployeeDepartment?: string;
  assignedEmployeeDesignation?: string;
  assignedAt?: string;
  assignedBy?: string;
  assignmentStatus?: 'Unassigned' | 'Assigned' | 'Reassigned';
  assignedStaffId?: string; // Legacy alias kept in sync with assignedEmployeeId

  logs: OrderLog[];
  feedback?: {
    rating: number;
    comment: string;
    date: string;
  };
  submittedReview?: {
    id?: string;
    reviewId?: string;
    rating: number;
    reviewText: string;
    status: string;
    createdAt?: string;
    adminNote?: string;
  } | null;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  subject: string;
  category: string;
  message: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  createdAt: string;
  replies: Array<{
    id: string;
    senderId: string;
    senderName: string;
    senderRole: UserRole;
    message: string;
    createdAt: string;
  }>;
}

export interface Coupon {
  code: string;
  type: 'Flat' | 'Percentage';
  value: number;
  expiryDate: string;
  usageLimit: number;
  usedCount: number;
}

export interface BlogComment {
  id: string;
  userName: string;
  comment: string;
  date: string;
}

export interface Blog {
  id: string;
  title: string;
  content: string;
  categoryId?: string;
  category: string;
  tags: string[];
  image: string;
  imageUrl?: string;
  author: string;
  date: string;
  publishedAt?: string;
  comments: BlogComment[];
  views: number;
  status?: string; // e.g. active, inactive, draft, published, scheduled
  featured?: boolean;
  excerpt?: string;

  shortDescription?: string;
  readTime?: string | number;
  scheduledAt?: string;
  seoTitle?: string;
  seoDescription?: string;
  slug?: string;
  focusKeywords?: string;
  commentsEnabled?: boolean;
  createdAt?: string;
}

export interface Review {
  id: string;
  reviewId?: string; // Optional canonical alias
  customerId?: string;
  customerName?: string;
  userName?: string;
  orderId?: string;
  serviceId?: string;
  serviceTitle?: string;
  serviceName?: string;
  rating: number;
  reviewText?: string;
  comment?: string;
  status?: 'Pending' | 'Approved' | 'Rejected' | 'Hidden';
  adminNote?: string;
  isDemo?: boolean;
  createdAt?: string;
  updatedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  isVerifiedOrder?: boolean;
  isVerified?: boolean;
  userAvatar?: string;
  photoUrl?: string;
  date?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'push' | 'email' | 'sms' | 'whatsapp';
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface MediaItem {
  id: string;
  name: string;
  originalName?: string;
  storedName?: string;
  storedFileName?: string;
  storagePath?: string;
  fileData?: string;
  mimeType?: string;
  type: 'image' | 'document' | 'video' | 'pdf' | 'word' | 'other';
  size: string;
  sizeBytes?: number;
  url: string;
  downloadUrl?: string;
  folder?: string;
  title?: string;
  altText?: string;
  accessLevel?: 'public' | 'restricted' | 'private';
  ownerId?: string;
  uploadedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export type ValidationSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
export type ValidationDomain = 'EMPLOYEE' | 'CUSTOMER' | 'ORDER' | 'SYSTEM';

export type ValidationIssueType =
  | 'ORPHANED_KYC'
  | 'ORPHANED_PAYROLL'
  | 'ORPHANED_ACCOUNT'
  | 'ORPHANED_DOCUMENT'
  | 'ORPHANED_ORDER_ASSIGNMENT'
  | 'ORPHANED_CUSTOMER_ORDER'
  | 'MISMATCHED_KEY'
  | 'MISMATCHED_EMPLOYEE_DATA'
  | 'MISMATCHED_CUSTOMER_DATA'
  | 'DUPLICATE_IDENTIFIER'
  | 'MISSING_FOREIGN_KEY'
  | 'UNLINKED_CUSTOMER_ORDER'
  | 'INVALID_STATUS';

export interface ValidationFinding {
  id: string;
  domain: ValidationDomain;
  collection: string;
  recordId: string;
  targetReferenceId?: string;
  severity: ValidationSeverity;
  issueType: ValidationIssueType;
  title: string;
  description: string;
  suggestedFix: string;
  autoFixable: boolean;
  affectedFields?: Record<string, any>;
}

export interface CollectionIntegritySummary {
  collection: string;
  totalRecords: number;
  healthyCount: number;
  orphanedCount: number;
  mismatchedCount: number;
  warningCount: number;
  status: 'HEALTHY' | 'WARNINGS' | 'CRITICAL';
}

export interface ValidationReport {
  timestamp: string;
  scanSource: 'D1_LIVE' | 'D1_STORE' | 'LOCAL_STATE';
  overallStatus: 'HEALTHY' | 'WARNINGS_FOUND' | 'CRITICAL_ERRORS';
  stats: {
    totalEmployeesChecked: number;
    totalCustomersChecked: number;
    totalOrdersChecked: number;
    totalKYCChecked: number;
    totalPayrollChecked: number;
    totalAccountsChecked: number;
    totalDocumentsChecked: number;
    totalIssuesFound: number;
    criticalIssuesCount: number;
    warningIssuesCount: number;
    infoIssuesCount: number;
    autoFixableCount: number;
  };
  summaryByCollection: Record<string, CollectionIntegritySummary>;
  findings: ValidationFinding[];
  repairsApplied?: {
    repairedKeysCount: number;
    relinkedOrdersCount: number;
    repairedEmployeesCount: number;
    repairedCustomersCount: number;
    details: string[];
  };
}

