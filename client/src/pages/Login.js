import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import Logo from '../components/Logo';

const Login = () => {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const result = await login(data.email, data.password);
      if (result.success) {
        toast.success('Login successful!');
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-100 py-8 sm:py-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="pointer-events-none absolute -top-32 -right-32 h-72 w-72 rounded-full bg-primary-200 opacity-40 blur-3xl"></div>
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-primary-300 opacity-30 blur-3xl"></div>

      <div className="max-w-md w-full">
        <div className="bg-white/80 backdrop-blur-xl shadow-xl ring-1 ring-black/5 rounded-2xl mobile-card space-y-6 sm:space-y-8">
          <div>
            <div className="mx-auto flex justify-center">
              <Logo size="large" />
            </div>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email address
                </label>
                <div className="relative">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className={`block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm sm:text-base transition-colors duration-200 ${errors.email ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                    placeholder="Enter your email"
                    {...register('email', {
                      required: 'Email is required',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Invalid email address',
                      },
                    })}
                  />
                  <span className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
                    <svg className="h-5 w-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </span>
                  {errors.email && (
                    <p className="mt-1 text-sm text-danger-600">{errors.email.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    className={`block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm sm:text-base transition-colors duration-200 ${errors.password ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                    placeholder="Enter your password"
                    {...register('password', {
                      required: 'Password is required',
                      minLength: {
                        value: 6,
                        message: 'Password must be at least 6 characters',
                      },
                    })}
                  />
                  <span className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
                    <svg className="h-5 w-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <circle cx="12" cy="16" r="1"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </span>
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center touch-target"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                  {errors.password && (
                    <p className="mt-1 text-sm text-danger-600">{errors.password.message}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-start">
              <label className="flex items-center space-x-2 text-sm text-gray-700 select-none cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 focus:ring-2"
                  {...register('rememberMe')}
                />
                <span>Remember me</span>
              </label>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 min-h-[48px]"
              >
                {isLoading ? (
                  <LoadingSpinner size="sm" className="mr-2" />
                ) : null}
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>


            
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
