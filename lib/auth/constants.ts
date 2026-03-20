export const AUTH_COOKIE_NAMES = {
  accessToken: "insforge_access_token",
  refreshToken: "insforge_refresh_token",
  oauthPkceVerifier: "insforge_oauth_pkce_verifier",
  postAuthRedirect: "insforge_post_auth_redirect",
  resetPasswordToken: "insforge_reset_password_token",
} as const;

export const DEFAULT_AUTH_REDIRECT = "/notes";
