import { useState, useEffect, useRef, useCallback } from "react";

interface CityAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

interface IBGECity {
  nome: string;
  microrregiao?: {
    mesorregiao?: {
      UF?: {
        sigla: string;
      };
    };
  };
}

let cityCache: { name: string; uf: string }[] = [];
let cachePromise: Promise<void> | null = null;

function loadCities(): Promise<void> {
  if (cityCache.length > 0) return Promise.resolve();
  if (cachePromise) return cachePromise;

  cachePromise = fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome")
    .then((res) => res.json())
    .then((data: IBGECity[]) => {
      cityCache = data.map((c) => ({
        name: c.nome,
        uf: c.microrregiao?.mesorregiao?.UF?.sigla ?? "",
      }));
    })
    .catch(() => {
      cachePromise = null;
    });

  return cachePromise;
}

export function CityAutocomplete({ value, onChange, placeholder, className }: CityAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<{ name: string; uf: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    loadCities().then(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChange = useCallback((text: string) => {
    onChange(text);
    if (text.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const lower = text.toLowerCase();
    const filtered = cityCache.filter((c) => c.name.toLowerCase().includes(lower)).slice(0, 8);
    setSuggestions(filtered);
    setOpen(filtered.length > 0);
  }, [onChange]);

  const handleSelect = (city: { name: string; uf: string }) => {
    onChange(`${city.name} - ${city.uf}`);
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        placeholder={loading ? "Carregando cidades..." : placeholder}
        className={className}
        autoComplete="off"
      />
      {open && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg bg-secondary border border-border shadow-lg">
          {suggestions.map((c, i) => (
            <li
              key={`${c.name}-${c.uf}-${i}`}
              onClick={() => handleSelect(c)}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-accent text-foreground transition-colors"
            >
              {c.name} <span className="text-muted-foreground">- {c.uf}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
