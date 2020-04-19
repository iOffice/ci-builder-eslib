import * as https from 'https';
import * as http from 'http';

import { Either, Left, Try, Success, Failure } from '@ioffice/fp';
import { Exception } from '../util';

function composeQuery(params: Record<string, string>): string {
  return Object.keys(params)
    .map(key => [key, encodeURIComponent(params[key].toString())].join('='))
    .join('&');
}

function toFailure<T>(msg: string, err: Error, data?: unknown): Try<T> {
  return Failure(new Exception({ message: msg, data }, err));
}

/**
 * Sends an http request.
 */
async function fetch<T>(
  protocol: 'http' | 'https',
  hostname: string,
  path: string,
  params: Record<string, string>,
  headers: Record<string, string>,
  method = 'GET',
  data?: unknown,
): Promise<Either<Exception, T>> {
  return new Promise(resolve => {
    const _query = composeQuery(params);
    const query = _query ? `?${_query}` : '';
    const body = JSON.stringify(data);
    const finalHeaders = {
      'User-Agent': 'iOFFICE-ciBuilder',
      ...headers,
    };
    if (data) {
      finalHeaders['Content-Type'] = 'application/json; charset=utf-8';
      finalHeaders['Content-Length'] = body.length;
    }
    const options: https.RequestOptions = {
      method,
      hostname,
      headers: finalHeaders,
      path: `${path}${query}`,
    };
    const requestMethod = protocol === 'https' ? https.request : http.request;
    const req = requestMethod(options, res => {
      const chunks: Buffer[] = [];
      res.on('data', chunk => {
        chunks.push(chunk);
      });
      res.on('end', () => {
        const result = Buffer.concat(chunks).toString();
        const response = Try<T>(() => JSON.parse(result))
          .transform(
            _ => Success(_),
            err => toFailure('failed to parse JSON string', err),
          )
          .toEither<Exception>();
        const code = res.statusCode ?? 500;
        if (code >= 200 && code < 300) {
          resolve(response);
        } else {
          resolve(
            Left(
              new Exception({
                message: `${protocol} request failure`,
                data: { path, body: result, code },
              }),
            ),
          );
        }
      });
    });
    req.on('error', error => {
      console.error(error);
    });
    if (data) {
      req.write(body);
    }
    req.end();
  });
}

export { fetch };
