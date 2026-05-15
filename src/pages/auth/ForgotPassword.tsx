import { Navigate, useSearchParams } from 'react-router-dom';

/** Old bookmarks and emails pointed here; open the login forgot-password modal instead. */
export default function ForgotPasswordRedirect() {
  const [searchParams] = useSearchParams();
  const legacy = Boolean(searchParams.get('token'));

  return (
    <Navigate
      to="/login"
      replace
      state={{
        openForgotPassword: true,
        ...(legacy ? { forgotLegacyLink: true } : {}),
      }}
    />
  );
}
