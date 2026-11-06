import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface ApiRequestOptions {
  withCredentials?: boolean;
  params?: HttpParams;
}

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';

  get<TResponse>(
    path: string,
    options: ApiRequestOptions = {},
  ): Observable<TResponse> {
    return this.http.get<TResponse>(`${this.baseUrl}${path}`, options);
  }

  post<TResponse, TBody = unknown>(
    path: string,
    body: TBody,
    options: ApiRequestOptions = {},
  ): Observable<TResponse> {
    return this.http.post<TResponse>(`${this.baseUrl}${path}`, body, options);
  }
}
