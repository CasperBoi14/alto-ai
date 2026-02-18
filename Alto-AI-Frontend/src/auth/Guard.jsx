import { Navigate } from 'react-router-dom'
import { isLoggedIn } from './tokens'

export default function Guard({ children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />
  return children
}
