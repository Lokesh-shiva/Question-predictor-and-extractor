import React from 'react';

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' }> = ({
  children,
  variant = 'primary',
  className = '',
  ...props
}) => {
  const baseStyles = "px-4 py-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-600",
    secondary: "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-600",
    outline: "border border-slate-300 text-slate-700 hover:bg-slate-50 focus:ring-indigo-600",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-indigo-600",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export const Badge: React.FC<{ children: React.ReactNode, color?: 'blue' | 'green' | 'yellow' | 'red' | 'gray' }> = ({ children, color = 'gray' }) => {
  const colors = {
    blue: "bg-indigo-100 text-indigo-800 border border-indigo-200",
    green: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    yellow: "bg-amber-100 text-amber-800 border border-amber-200",
    red: "bg-red-100 text-red-800 border border-red-200",
    gray: "bg-slate-100 text-slate-700 border border-slate-200",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
};

export const Card: React.FC<{ children: React.ReactNode, className?: string, selected?: boolean, onClick?: () => void, id?: string }> = ({ children, className = '', selected, onClick, id }) => {
  return (
    <div
      id={id}
      onClick={onClick}
      className={`bg-white rounded-xl border transition-all ${selected ? 'border-indigo-600 ring-2 ring-indigo-600 shadow-md' : 'border-slate-200 shadow-sm hover:border-slate-300'} ${className}`}
    >
      {children}
    </div>
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ label, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>}
      <input
        className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 focus:outline-none transition-shadow ${className}`}
        {...props}
      />
    </div>
  );
};

export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;
  
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl'
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 animate-in fade-in duration-200">
      <div className={`bg-white rounded-xl shadow-xl w-full ${sizeClasses[size]} overflow-hidden transform transition-all scale-100 max-h-[90vh] flex flex-col`}>
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-lg text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export const ToastContainer: React.FC<{ toasts: ToastMessage[]; removeToast: (id: string) => void }> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center w-80 p-4 rounded-lg shadow-lg border-l-4 transition-all transform animate-slide-up
            ${t.type === 'error' ? 'bg-white border-red-600 text-slate-900' :
              t.type === 'success' ? 'bg-white border-emerald-600 text-slate-900' :
                'bg-slate-800 border-indigo-600 text-white'}`}
          role="alert"
        >
          <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full mr-3 ${t.type === 'error' ? 'bg-red-100 text-red-600' :
              t.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                'bg-slate-700 text-slate-300'
            }`}>
            {t.type === 'error' && (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
              </svg>
            )}
            {t.type === 'success' && (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
              </svg>
            )}
            {t.type === 'info' && (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M11.25 4.5a.75.75 0 0 1 .75.75v8.25a.75.75 0 0 1-1.5 0V5.25a.75.75 0 0 1 .75-.75Zm0 11.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div className="flex-1 text-sm font-medium">{t.message}</div>
          <button onClick={() => removeToast(t.id)} className="ml-2 text-slate-400 hover:text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
};
