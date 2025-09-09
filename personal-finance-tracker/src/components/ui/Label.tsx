import { LabelHTMLAttributes } from 'react';

export default function Label(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className="mb-1 block text-sm font-medium text-gray-700" {...props} />;
}

