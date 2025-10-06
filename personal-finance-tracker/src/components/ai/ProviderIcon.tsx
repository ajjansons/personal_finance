import type { AiProviderId } from '@/ai/types';

type ProviderIconProps = {
  provider: AiProviderId | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const ICON_SIZES = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6'
};

export default function ProviderIcon({ provider, size = 'sm', className = '' }: ProviderIconProps) {
  const sizeClass = ICON_SIZES[size];

  if (provider === 'openai') {
    return (
      <svg
        className={`${sizeClass} ${className}`}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        title="OpenAI"
      >
        <path
          d="M22.2819 9.8211C22.6699 8.8901 22.8739 7.8841 22.8739 6.8571C22.8739 3.0761 19.7979 0.0001 15.9999 0.0001C14.6219 0.0001 13.3239 0.4361 12.2419 1.1931C11.1599 0.4361 9.8619 0.0001 8.4839 0.0001C4.6859 0.0001 1.6099 3.0761 1.6099 6.8571C1.6099 7.8841 1.8139 8.8901 2.2019 9.8211C1.8139 10.7521 1.6099 11.7581 1.6099 12.7851C1.6099 16.5661 4.6859 19.6421 8.4839 19.6421C9.8619 19.6421 11.1599 19.2061 12.2419 18.4491C13.3239 19.2061 14.6219 19.6421 15.9999 19.6421C19.7979 19.6421 22.8739 16.5661 22.8739 12.7851C22.8739 11.7581 22.6699 10.7521 22.2819 9.8211Z"
          fill="currentColor"
          opacity="0.4"
        />
        <path
          d="M12.2419 9.8211C11.4049 9.8211 10.7239 10.5021 10.7239 11.3391C10.7239 12.1761 11.4049 12.8571 12.2419 12.8571C13.0789 12.8571 13.7599 12.1761 13.7599 11.3391C13.7599 10.5021 13.0789 9.8211 12.2419 9.8211Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (provider === 'anthropic') {
    return (
      <svg
        className={`${sizeClass} ${className}`}
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        title="Anthropic Claude"
      >
        <rect x="2" y="2" width="9" height="20" rx="1" opacity="0.8" />
        <rect x="13" y="2" width="9" height="20" rx="1" opacity="0.5" />
      </svg>
    );
  }

  if (provider === 'xai') {
    return (
      <svg
        className={`${sizeClass} ${className}`}
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        title="xAI Grok"
      >
        <path
          d="M3 3L11 12L3 21M13 3L21 12L13 21"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  }

  // Generic AI icon fallback
  return (
    <svg
      className={`${sizeClass} ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      title="AI"
    >
      <circle cx="12" cy="12" r="9" strokeWidth="2" opacity="0.5" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}
