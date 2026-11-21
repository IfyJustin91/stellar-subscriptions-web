'use client';

import { useCallback, useContext, useMemo } from 'react';
import { WalletContext } from '@/hooks/useWallet';
import { useSubscriptionNotes } from '@/hooks/useSubscriptionNotes';
import type { Network } from '@/types';

import { useToken } from '@/hooks/useToken';

export interface Subscriber {
  /** Subscription id, used to key the merchant's private notes. */
  id?: number | string;
  address: string;
  tokenSymbol: string;
  tokenAddress: string;
  /** Raw amount as a bigint (or its exact decimal string) — never a float. */
  rawAmount: bigint | string;
  /** Number of decimals for the token, used to format the display amount. */
  decimals: number;
  status: string;
}

interface SubscriberTableProps {
  subscribers: Subscriber[];
  /** Optional filename for the CSV download. */
  fileName?: string;
  /** Network the notes are stored under; defaults to the connected wallet's. */
  network?: Network;
}

/**
 * Format a raw integer amount (bigint or decimal string) into a human-readable
 * decimal string using the token's decimals. Uses pure string manipulation so
 * there is no floating-point rounding.
 */
function formatAmount(rawAmount: bigint | string, decimals: number): string {
  const raw = typeof rawAmount === 'bigint' ? rawAmount.toString() : rawAmount.trim();

  // Handle optional sign.
  const negative = raw.startsWith('-');
  const digits = negative ? raw.slice(1) : raw;

  // Guard against non-numeric input.
  if (!/^\d+$/.test(digits)) {
    return raw;
  }

  if (decimals <= 0) {
    return `${negative ? '-' : ''}${digits}`;
  }

  const padded = digits.padStart(decimals + 1, '0');
  const integerPart = padded.slice(0, padded.length - decimals);
  const fractionalPart = padded.slice(padded.length - decimals).replace(/0+$/, '');

  const sign = negative ? '-' : '';
  return fractionalPart.length > 0
    ? `${sign}${integerPart}.${fractionalPart}`
    : `${sign}${integerPart}`;
}

/** Escape a single CSV field per RFC 4180. */
function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Shorten a contract id for display while the token symbol is loading. */
function shortenAddress(address: string): string {
  if (address.length <= 10) {
    return address;
  }
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

interface TokenSymbolProps {
  tokenAddress: string;
}

/**
 * Renders the token symbol resolved via `useToken`, falling back to a shortened
 * contract id while loading or if the symbol cannot be resolved.
 */
function TokenSymbol({ tokenAddress }: TokenSymbolProps) {
  const { symbol } = useToken(tokenAddress);
  return <>{symbol ?? shortenAddress(tokenAddress)}</>;
}

function buildCsv(subscribers: Subscriber[]): string {
  const header = [
    'Subscriber Address',
    'Token Symbol',
    'Token Address',
    'Raw Amount',
    'Formatted Amount',
    'Status',
  ];

  const rows = subscribers.map((subscriber) => {
    const raw =
      typeof subscriber.rawAmount === 'bigint'
        ? subscriber.rawAmount.toString()
        : subscriber.rawAmount.trim();
    const formatted = `${formatAmount(subscriber.rawAmount, subscriber.decimals)} ${subscriber.tokenSymbol}`;

    return [
      subscriber.address,
      subscriber.tokenSymbol,
      subscriber.tokenAddress,
      raw,
      formatted,
      subscriber.status,
    ];
  });

  return [header, ...rows]
    .map((row) => row.map((field) => escapeCsvField(String(field))).join(','))
    .join('\r\n');
}

export default function SubscriberTable({
  subscribers,
  fileName = 'subscribers.csv',
  network,
}: SubscriberTableProps) {
  const wallet = useContext(WalletContext);
  const notesNetwork = network ?? wallet?.network ?? 'testnet';
  const { getNote, setNote } = useSubscriptionNotes(notesNetwork);

  const rows = useMemo(
    () =>
      subscribers.map((subscriber) => ({
        ...subscriber,
        rawDisplay:
          typeof subscriber.rawAmount === 'bigint'
            ? subscriber.rawAmount.toString()
            : subscriber.rawAmount,
        formattedDisplay: `${formatAmount(subscriber.rawAmount, subscriber.decimals)} ${subscriber.tokenSymbol}`,
      })),
    [subscribers],
  );

  // Unique token contract ids, so each token's symbol is resolved once.
  const uniqueTokenAddresses = useMemo(
    () => Array.from(new Set(subscribers.map((subscriber) => subscriber.tokenAddress))),
    [subscribers],
  );

  const handleDownloadCsv = useCallback(() => {
    const csv = buildCsv(subscribers);
    // Prepend a BOM so spreadsheet apps detect UTF-8 correctly.
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }, [subscribers, fileName]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
        <button type="button" onClick={handleDownloadCsv} disabled={subscribers.length === 0}>
          Download CSV
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th scope="col">Subscriber</th>
            <th scope="col">Token</th>
            <th scope="col">Token Address</th>
            <th scope="col">Raw Amount</th>
            <th scope="col">Formatted Amount</th>
            <th scope="col">Status</th>
            <th scope="col">Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7}>No subscribers yet.</td>
            </tr>
          ) : (
            rows.map((row) => {
              const noteKey = row.id ?? `${row.address}-${row.tokenAddress}`;
              return (
                <tr key={`${row.address}-${row.tokenAddress}`}>
                  <td>
                    <code>{row.address}</code>
                  </td>
                  <td>{row.tokenSymbol}</td>
                  <td>
                    <code>{row.tokenAddress}</code>
                  </td>
                  <td>
                    <code>{row.rawDisplay}</code>
                  </td>
                  <td>{row.formattedDisplay}</td>
                  <td>{row.status}</td>
                  <td>
                    <input
                      // Re-key per network and subscription so switching either
                      // shows the note stored for that pair.
                      key={`${notesNetwork}:${noteKey}`}
                      type="text"
                      defaultValue={getNote(noteKey)}
                      onBlur={(event) => setNote(noteKey, event.target.value)}
                      placeholder="Add a note"
                      aria-label={`Note for subscriber ${row.address}`}
                      className="w-full min-w-40 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                  </td>
                </tr>
              );
            })
            rows.map((row) => (
              <tr key={`${row.address}-${row.tokenAddress}`}>
                <td>
                  <code>{row.address}</code>
                </td>
                <td>
                  <TokenSymbol tokenAddress={row.tokenAddress} />
                </td>
                <td>
                  <code>{row.tokenAddress}</code>
                </td>
                <td>
                  <code>{row.rawDisplay}</code>
                </td>
                <td>{row.formattedDisplay}</td>
                <td>{row.status}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Resolve each unique token's symbol once; results are cached by useToken. */}
      <div hidden aria-hidden="true">
        {uniqueTokenAddresses.map((tokenAddress) => (
          <TokenSymbol key={tokenAddress} tokenAddress={tokenAddress} />
        ))}
      </div>
    </div>
  );
}