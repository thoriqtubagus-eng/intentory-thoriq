export const ROLES = {
  ADMIN: "admin",
  WAREHOUSE: "warehouse_staff",
  HEAD_OF_WAREHOUSE: "head_of_warehouse",
  DEPARTMENT: "department_user",
  DIVISI: "divisi"
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
