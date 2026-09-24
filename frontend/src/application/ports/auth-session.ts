export interface AuthSession {
  getUserId(): string | null;
  getAccessToken(): Promise<string | null>;
}
