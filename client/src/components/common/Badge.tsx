import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'purple' | 'neutral' | 'outline';
  size?: 'sm' | 'md';
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
  dot = false
}) => {
  const variantStyles = {
    primary: 'bg-blue-50 text-blue-700 border border-blue-200',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border border-rose-200',
    purple: 'bg-purple-50 text-purple-700 border border-purple-200',
    neutral: 'bg-slate-100 text-slate-700 border border-slate-200',
    outline: 'bg-white text-slate-600 border border-slate-200'
  };

  const dotColors = {
    primary: 'bg-blue-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    purple: 'bg-purple-500',
    neutral: 'bg-slate-400',
    outline: 'bg-slate-400'
  };

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs font-medium px-2.5 py-1'
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
};

export function getStatusBadge(status: string) {
  switch (status) {
    case 'Inside':
    case 'Present':
    case 'Approved':
    case 'Returned':
    case 'Resolved':
      return <Badge variant="success" dot>{status}</Badge>;

    case 'Outside':
    case 'Pending':
    case 'Acknowledged':
    case 'Excused':
      return <Badge variant="warning" dot>{status}</Badge>;

    case 'On Leave':
      return <Badge variant="purple" dot>{status}</Badge>;

    case 'Overdue':
    case 'Verification Failed':
    case 'Absent':
    case 'Rejected':
    case 'Critical':
      return <Badge variant="danger" dot>{status}</Badge>;

    case 'High':
      return <Badge variant="danger">{status}</Badge>;
    case 'Medium':
      return <Badge variant="warning">{status}</Badge>;
    case 'Low':
      return <Badge variant="neutral">{status}</Badge>;

    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
}
