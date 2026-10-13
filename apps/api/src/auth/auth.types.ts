export type GlobalRole = 'ADMIN' | 'EMPLOYEE';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  globalRole: GlobalRole;
};

export type AuthProfile = AuthUser & {
  leadAreaIds: string[];
  memberships: {
    areaId: string;
    areaName: string;
    canAssign: boolean;
    canClose: boolean;
  }[];
};
