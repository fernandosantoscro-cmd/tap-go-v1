/** Utilitários de CPF usados no checkout e na busca de pedidos pelo balcão. */

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function maskCpf(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)].filter(Boolean);
  const tail = digits.slice(9, 11);
  let out = parts.join(".");
  if (tail) out += `-${tail}`;
  return out;
}

/** Valida os dígitos verificadores do CPF. */
export function isValidCpf(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const check = (size: number) => {
    let sum = 0;
    for (let index = 0; index < size; index += 1) {
      sum += Number(digits[index]) * (size + 1 - index);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

/** Exibição parcial para o painel, sem expor o documento completo. */
export function maskedCpfPreview(value: string | null | undefined): string {
  const digits = onlyDigits(value ?? "");
  if (digits.length !== 11) return "—";
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}
