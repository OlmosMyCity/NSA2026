import { redirect } from 'next/navigation';

export default function VisionRedirectPage() {
  redirect('/readings/new');
}
