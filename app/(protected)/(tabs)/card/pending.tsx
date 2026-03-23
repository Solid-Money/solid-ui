import { CardStatusPage } from '@/components/Card/CardStatusPage';

export default function CardPending() {
  return (
    <CardStatusPage
      title="Your card is on its way!"
      description={
        'Thanks for your submission. Your\nidentity is now being verified. You will be\nnotified by mail once you get approved'
      }
    />
  );
}
