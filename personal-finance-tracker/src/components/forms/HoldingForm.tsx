import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Holding } from '@/lib/repository/types';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { useCategories } from '@/hooks/useCategories';
import { chainProvider } from '@/lib/market-data/chainProvider';
import { convert, useUsdEurRate } from '@/lib/fx/twelveDataFx';

type Props = {
  initial?: Partial<Holding>;
  onSubmit: (hl: Omit<Holding, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>) => void;
};

const TYPES = ['stock', 'crypto', 'cash', 'real_estate', 'other'] as const;
type PriceMode = 'manual' | 'live';

const normalizeFiat = (code: string | undefined): 'USD' | 'EUR' => (code && code.toUpperCase() === 'USD') ? 'USD' : 'EUR';

export default function HoldingForm({ initial, onSubmit }: Props) {
  const { data: categories = [] } = useCategories();
  const initialType = (initial?.type as Holding['type']) ?? 'stock';

  const { rate } = useUsdEurRate();

  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<Exclude<Holding['type'], undefined>>(initialType);
  const [symbol, setSymbol] = useState(initial?.symbol?.toUpperCase() ?? '');
  const [units, setUnits] = useState(initial?.units ?? 0);
  const [pricePerUnit, setPricePerUnit] = useState(initial?.pricePerUnit ?? 0);
  const [currency, setCurrency] = useState((initial?.currency ?? 'EUR').toUpperCase());
  const [categoryId, setCategoryId] = useState<string | undefined>(initial?.categoryId);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [purchaseDate, setPurchaseDate] = useState<string>(initial?.purchaseDate ?? today);
  const [error, setError] = useState<string | null>(null);

  const normalizedInitialBuyCurrency = normalizeFiat(initial?.buyValueCurrency ?? initial?.currency);
  const [buyValueCurrency, setBuyValueCurrency] = useState<'USD' | 'EUR'>(normalizedInitialBuyCurrency);
  const [buyValue, setBuyValue] = useState<number | ''>(
    typeof initial?.buyValue === 'number' ? initial.buyValue : ''
  );
  const [hydratedBuyValue, setHydratedBuyValue] = useState(!initial?.id);

  const [priceMode, setPriceMode] = useState<PriceMode>(() => {
    if (initial?.id) return 'manual';
    return (initialType === 'stock' || initialType === 'crypto') ? 'live' : 'manual';
  });
  const [quoteMeta, setQuoteMeta] = useState<{ price: number; currency: 'USD' | 'EUR'; asOf: string } | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [quoteRequestId, setQuoteRequestId] = useState(0);

  const isStockLike = type === 'stock' || type === 'crypto';
  const canUseLivePrice = type === 'stock'
    ? Boolean(import.meta.env.VITE_TWELVE_DATA_KEY)
    : type === 'crypto'
      ? Boolean(import.meta.env.VITE_COINGECKO_API_KEY)
      : false;

  useEffect(() => {
    if (!isStockLike && priceMode !== 'manual') {
      setPriceMode('manual');
    }
  }, [isStockLike, priceMode]);

  useEffect(() => {
    if (priceMode === 'live' && !canUseLivePrice) {
      setPriceMode('manual');
    }
  }, [priceMode, canUseLivePrice]);

  useEffect(() => {
    if (initial?.id && !hydratedBuyValue && typeof initial.buyValue === 'number') {
      const holdingCurrency = normalizeFiat(initial.currency);
      const target = buyValueCurrency;
      const converted = convert(initial.buyValue, holdingCurrency, target, rate);
      setBuyValue(Number(converted.toFixed(2)));
      setHydratedBuyValue(true);
    }
  }, [initial, rate, buyValueCurrency, hydratedBuyValue]);

  useEffect(() => {
    if (priceMode === 'manual') {
      setQuoteMeta(null);
      setQuoteError(null);
      setIsFetchingQuote(false);
      return;
    }
    if (!isStockLike) return;
    const sym = symbol.trim().toUpperCase();
    if (!sym) {
      setQuoteMeta(null);
      setQuoteError('Enter a symbol to fetch live price.');
      setIsFetchingQuote(false);
      return;
    }
    if (!canUseLivePrice) {
      setQuoteMeta(null);
      setQuoteError('Live pricing is unavailable. Provide an API key or use manual price.');
      setIsFetchingQuote(false);
      return;
    }
    let cancelled = false;
    setIsFetchingQuote(true);
    setQuoteError(null);
    const handle = setTimeout(async () => {
      try {
        const quote = await chainProvider.getQuote(sym, type as 'stock' | 'crypto');
        if (cancelled) return;
        const precision = type === 'crypto' ? 6 : 2;
        const normalizedPrice = Number(quote.price.toFixed(precision));
        setPricePerUnit(normalizedPrice);
        setQuoteMeta({ price: quote.price, currency: quote.currency, asOf: quote.asOf });
        setCurrency(quote.currency);
        setBuyValue('');
        setBuyValueCurrency(quote.currency);
        setQuoteError(null);
      } catch (err) {
        if (cancelled) return;
        let message = err instanceof Error ? err.message : 'Failed to fetch live price.';
        if (/missing/i.test(message) && /twelve/i.test(message)) {
          message = 'Live stock pricing requires a Twelve Data API key.';
        } else if (/missing/i.test(message) && /coingecko/i.test(message)) {
          message = 'Live crypto pricing requires a CoinGecko API key.';
        } else if (/not found/i.test(message)) {
          message = 'No live price found for that symbol.';
        }
        setQuoteError(message);
        setQuoteMeta(null);
      } finally {
        if (!cancelled) setIsFetchingQuote(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [priceMode, symbol, type, canUseLivePrice, quoteRequestId, isStockLike]);

  const liveStatus = priceMode === 'live' && isStockLike ? (() => {
    if (!canUseLivePrice) {
      return { text: 'Live pricing unavailable. Add API credentials or switch to manual.', tone: 'text-amber-400' };
    }
    if (!symbol.trim()) {
      return { text: 'Enter a symbol to fetch live price.', tone: 'text-slate-400' };
    }
    if (isFetchingQuote) {
      return { text: 'Fetching live price...', tone: 'text-slate-400' };
    }
    if (quoteError) {
      return { text: quoteError, tone: 'text-red-500' };
    }
    if (quoteMeta) {
      const formatted = new Intl.NumberFormat(undefined, { style: 'currency', currency: quoteMeta.currency }).format(quoteMeta.price);
      const time = new Date(quoteMeta.asOf).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      return { text: `Live price ${formatted} as of ${time}`, tone: 'text-emerald-400' };
    }
    return { text: 'Enter a symbol to fetch live price.', tone: 'text-slate-400' };
  })() : null;

  const handleBuyValueCurrencyChange = (next: 'USD' | 'EUR') => {
    if (next === buyValueCurrency) return;
    if (buyValue !== '') {
      const converted = convert(Number(buyValue), buyValueCurrency, next, rate);
      setBuyValue(Number(converted.toFixed(2)));
    }
    setBuyValueCurrency(next);
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    const isValueMode = type === 'cash' || type === 'real_estate';

    if (!isValueMode) {
      if (Number.isNaN(units) || units < 0) {
        setError('Please enter valid shares.');
        return;
      }
      if (priceMode === 'live') {
        if (isFetchingQuote) {
          setError('Please wait for the live price to finish loading.');
          return;
        }
        if (!quoteMeta) {
          setError(quoteError || 'Live price unavailable. Switch to manual price or try again.');
          return;
        }
      }
      if (Number.isNaN(pricePerUnit) || pricePerUnit < 0) {
        setError('Please enter a valid price per share.');
        return;
      }
      if (buyValue !== '' && (Number.isNaN(Number(buyValue)) || Number(buyValue) < 0)) {
        setError('Buy value cannot be negative.');
        return;
      }
    } else {
      if (buyValue === '' || Number.isNaN(Number(buyValue)) || Number(buyValue) < 0) {
        setError('Please enter a valid amount.');
        return;
      }
    }

    const pricePrecision = type === 'crypto' ? 6 : 2;
    const normalizedPrice = Number((pricePerUnit ?? 0).toFixed(pricePrecision));
    setError(null);

    const trimmedSymbol = symbol.trim();
    const holdingCurrency = normalizeFiat(currency);

    const payload: any = {
      type,
      name,
      symbol: trimmedSymbol ? trimmedSymbol.toUpperCase() : undefined,
      currency,
      categoryId,
      purchaseDate,
      tags: initial?.tags ?? [],
      notes: initial?.notes ?? ''
    };

    if (isValueMode) {
      const normalizedAmount = Number(Number(buyValue).toFixed(2));
      payload.units = 1;
      payload.pricePerUnit = normalizedAmount;
      payload.buyValue = normalizedAmount;
      payload.buyValueCurrency = holdingCurrency;
    } else {
      payload.units = Number(units);
      payload.pricePerUnit = normalizedPrice;
      const computedBuy = Number((Number(units) * normalizedPrice).toFixed(2));
      if (buyValue !== '') {
        const converted = convert(Number(buyValue), buyValueCurrency, holdingCurrency, rate);
        payload.buyValue = Number(converted.toFixed(2));
        payload.buyValueCurrency = buyValueCurrency;
      } else {
        payload.buyValue = computedBuy;
        payload.buyValueCurrency = holdingCurrency;
      }
    }

    onSubmit(payload);
  }

  return (
    <form className="grid gap-3" onSubmit={submit}>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div>
        <Label htmlFor="hf-name">Name</Label>
        <Input id="hf-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="hf-type">Type</Label>
        <Select id="hf-type" value={type} onChange={(e) => setType(e.target.value as any)}>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>
      {(type !== 'cash' && type !== 'real_estate') && (
        <div>
          <Label htmlFor="hf-symbol">Symbol</Label>
          <Input id="hf-symbol" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
        </div>
      )}
      <div>
        <Label htmlFor="hf-category">Category</Label>
        <Select
          id="hf-category"
          value={categoryId ?? ''}
          onChange={(e) => setCategoryId(e.target.value || undefined)}
        >
          <option value="">Uncategorized</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      {isStockLike ? (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="hf-units">Shares</Label>
              <Input
                id="hf-units"
                type="number"
                step="any"
                min="0"
                value={units}
                onChange={(e) => setUnits(Number(e.target.value))}
                required
              />
            </div>
            <div className="space-y-2">
              <div>
                <Label htmlFor="hf-ppu-mode">Price source</Label>
                <Select
                  id="hf-ppu-mode"
                  value={priceMode}
                  onChange={(e) => setPriceMode(e.target.value as PriceMode)}
                >
                  <option value="live" disabled={!canUseLivePrice}>
                    Use live market price
                  </option>
                  <option value="manual">Set a custom price manually</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="hf-ppu">Price per share</Label>
                <Input
                  id="hf-ppu"
                  type="number"
                  step={type === 'crypto' ? '0.000001' : '0.01'}
                  min="0"
                  value={pricePerUnit}
                  onChange={(e) => setPricePerUnit(Number(e.target.value))}
                  required={priceMode !== 'live'}
                  disabled={priceMode === 'live'}
                />
              </div>
              {priceMode === 'live' && liveStatus && (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className={liveStatus.tone}>{liveStatus.text}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setQuoteRequestId((id) => id + 1)}
                    disabled={!canUseLivePrice || !symbol.trim() || isFetchingQuote}
                  >
                    Refresh
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="hf-bv">Buy Value (optional)</Label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Input
                id="hf-bv"
                type="number"
                step="0.01"
                min="0"
                value={buyValue === '' ? '' : buyValue}
                onChange={(e) => {
                  const val = e.target.value;
                  setBuyValue(val === '' ? '' : Number(val));
                }}
                disabled={priceMode === 'live'}
                placeholder="0.00"
              />
              <Select
                value={buyValueCurrency}
                onChange={(e) => handleBuyValueCurrencyChange(e.target.value === 'USD' ? 'USD' : 'EUR')}
                disabled={priceMode === 'live'}
                aria-label="Buy value currency"
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </Select>
            </div>
          </div>
        </>
      ) : (
        <div>
          <Label htmlFor="hf-amount">{type === 'cash' ? 'Amount' : 'Total Amount'}</Label>
          <Input
            id="hf-amount"
            type="number"
            step="0.01"
            min="0"
            value={buyValue === '' ? '' : buyValue}
            onChange={(e) => setBuyValue(e.target.value === '' ? '' : Number(e.target.value))}
            required
          />
        </div>
      )}
      <div>
        <Label htmlFor="hf-curr">Currency</Label>
        <Input
          id="hf-curr"
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          disabled={priceMode === 'live' && !!quoteMeta}
        />
        {priceMode === 'live' && quoteMeta && (
          <p className="text-xs text-slate-400">Currency is set by the live quote provider.</p>
        )}
      </div>
      <div>
        <Label htmlFor="hf-purchase">Buy date</Label>
        <Input
          id="hf-purchase"
          type="date"
          value={purchaseDate}
          onChange={(e) => setPurchaseDate(e.target.value)}
          required
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={priceMode === 'live' && isFetchingQuote}>Save</Button>
      </div>
    </form>
  );
}
