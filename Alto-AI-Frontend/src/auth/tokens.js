export function isLoggedIn() {
  return !!localStorage.getItem('refresh_token')
}
