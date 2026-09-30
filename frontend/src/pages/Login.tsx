import { API_BASE_URL } from '../config/api';

const Login = () => {
  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE_URL}/api/auth/google`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="bg-card w-full max-w-[440px] rounded-2xl shadow-sm border border-gray-100 p-10 flex flex-col items-center">
        <h1 className="text-3xl font-bold mb-8 text-gray-900">Login</h1>
        
        <button
          onClick={handleGoogleLogin}
          className="w-full bg-[#E8F5EE] hover:bg-[#D5EFE2] text-[#059669] font-medium py-3 rounded-lg flex items-center justify-center transition-colors mb-6"
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5 mr-3" />
          Login with Google
        </button>

        <div className="flex items-center w-full mb-6">
          <div className="h-px bg-gray-200 flex-1"></div>
          <span className="px-4 text-xs text-gray-400">or sign up through email</span>
          <div className="h-px bg-gray-200 flex-1"></div>
        </div>

        <input
          type="text"
          placeholder="Email ID"
          className="w-full bg-[#F6F7F9] border-none outline-none focus:ring-1 focus:ring-primary rounded-lg py-3 px-4 mb-4 text-sm"
          disabled // Not required by assignment
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full bg-[#F6F7F9] border-none outline-none focus:ring-1 focus:ring-primary rounded-lg py-3 px-4 mb-6 text-sm"
          disabled // Not required by assignment
        />

        <button
          className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-3 rounded-lg transition-colors"
          disabled // Not required by assignment
        >
          Login
        </button>
      </div>
    </div>
  );
};

export default Login;
