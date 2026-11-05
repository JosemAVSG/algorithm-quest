/**
 * Symbols a phone keyboard buries under two layers. Shown only on narrow
 * screens (CSS); every button is a full-size touch target.
 */

const SYMBOLS: ReadonlyArray<{ text: string; label: string; show?: string }> = [
  { text: '  ', label: 'Sangría', show: '⇥' },
  { text: '{', label: 'Llave que abre' },
  { text: '}', label: 'Llave que cierra' },
  { text: '(', label: 'Paréntesis que abre' },
  { text: ')', label: 'Paréntesis que cierra' },
  { text: '[', label: 'Corchete que abre' },
  { text: ']', label: 'Corchete que cierra' },
  { text: ';', label: 'Punto y coma' },
  { text: '=', label: 'Igual' },
  { text: '<', label: 'Menor que' },
  { text: '>', label: 'Mayor que' },
  { text: '!', label: 'Negación' },
  { text: '&&', label: 'Y lógico' },
  { text: '||', label: 'O lógico' },
  { text: "'", label: 'Comilla simple' },
];

interface SymbolBarProps {
  disabled: boolean;
  onInsert: (text: string) => void;
}

export function SymbolBar({ disabled, onInsert }: SymbolBarProps) {
  return (
    <div className="symbols" role="toolbar" aria-label="Símbolos de código">
      {SYMBOLS.map((symbol) => (
        <button
          key={symbol.label}
          type="button"
          className="symbols__key"
          aria-label={symbol.label}
          disabled={disabled}
          // Keep focus (and the keyboard) in the editor.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onInsert(symbol.text)}
        >
          {symbol.show ?? symbol.text}
        </button>
      ))}
    </div>
  );
}
