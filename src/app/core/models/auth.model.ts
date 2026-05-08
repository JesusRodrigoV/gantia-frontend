export interface AuthRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
  };
}

export interface ValidationErrorDetail {
  loc: (string | number)[];
  msg: string;
  type: string;
  input?: string;
  ctx?: Record<string, any>;
}

export interface ValidationErrorResponse {
  detail: ValidationErrorDetail[];
}
