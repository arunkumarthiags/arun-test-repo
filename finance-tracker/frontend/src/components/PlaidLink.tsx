import { useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Link as LinkIcon } from 'lucide-react';
import { plaidApi } from '../services/api';

interface PlaidLinkProps {
  onSuccess?: () => void;
}

export default function PlaidLink({ onSuccess }: PlaidLinkProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createLinkToken();
  }, []);

  const createLinkToken = async () => {
    try {
      const response = await plaidApi.createLinkToken();
      setLinkToken(response.data.link_token);
      setError(null);
    } catch (error) {
      console.error('Error creating link token:', error);
      setError('Failed to initialize Plaid');
    }
  };

  const handleOnSuccess = async (publicToken: string) => {
    try {
      setLoading(true);
      await plaidApi.exchangePublicToken(publicToken);

      // Sync transactions after connecting account
      const items = await plaidApi.getItems();
      if (items.data.items.length > 0) {
        const latestItem = items.data.items[0];
        await plaidApi.syncTransactions(latestItem.item_id);
      }

      onSuccess?.();
    } catch (error) {
      console.error('Error exchanging public token:', error);
      alert('Failed to connect account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleOnSuccess,
  });

  if (error) {
    return (
      <button
        onClick={createLinkToken}
        className="btn btn-secondary flex items-center"
        title="Click to retry"
      >
        <LinkIcon size={20} className="mr-2" />
        Retry Connection
      </button>
    );
  }

  if (!linkToken || loading) {
    return (
      <button disabled className="btn btn-primary opacity-50 cursor-not-allowed">
        <LinkIcon size={20} className="mr-2" />
        Loading...
      </button>
    );
  }

  return (
    <button
      onClick={() => open()}
      disabled={!ready}
      className="btn btn-primary flex items-center"
    >
      <LinkIcon size={20} className="mr-2" />
      Connect Bank Account
    </button>
  );
}
