import { UserRole } from '../../users/user-role.enum';

export interface AuthenticatedUser {
  id: number;
  email: string;
  role: UserRole;
}
