const EBAY_AUTH_URL = "/ebayAuthRedirect";

const Login = () => {
  const signInWithEbay = () => {
    window.location.href = EBAY_AUTH_URL;
  };

  return (
    <button className="btn-signin" onClick={signInWithEbay}>Sign in with eBay</button>
  );
};

export default Login;
