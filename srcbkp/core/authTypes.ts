export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserInfo {
  id: string;
  username: string;
  name: string;
  cliente: string;
}
