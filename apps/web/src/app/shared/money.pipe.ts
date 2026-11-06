import { CurrencyPipe } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'money',
  standalone: true,
})
export class MoneyPipe implements PipeTransform {
  private readonly currencyPipe = new CurrencyPipe('en-ZA');

  transform(cents: number | null | undefined): string {
    if (cents === null || cents === undefined) {
      return '—';
    }

    if (!Number.isFinite(cents)) {
      return 'Invalid amount';
    }

    return this.currencyPipe.transform(
      cents / 100,
      'ZAR',
      'symbol',
      '1.2-2',
      'en-ZA',
    ) ?? '';
  }
}
