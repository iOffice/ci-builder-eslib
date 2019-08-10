import { Either, Left, Right } from './Either';
import { None, Option, Some } from './Option';
import { LazyArg, extractLazyArg } from './Types';

/**
 */
abstract class TryW<T> {
  /**
   * Returns `true` if the `Try` is a `Failure`, `false` otherwise.
   */
  abstract readonly isFailure: boolean;

  /**
   * Returns `true` if the `Try` is a `Success`, `false` otherwise.
   */
  abstract readonly isSuccess: boolean;

  /**
   * Returns the value from this `Success` or throws the exception if this is a
   * `Failure`.
   */
  abstract get(): T;

  /**
   * Returns the value from this `Success` or the given `default` argument if
   * this is a `Failure`.
   *
   * ''Note:'': This will throw an exception if it is not a success and default
   * throws an exception.
   */
  getOrElse(alt: LazyArg<T>): T {
    return this.isFailure ? extractLazyArg(alt) : this.get();
  }

  /**
   * Returns this `Try` if it's a `Success` or the given `default` argument if
   * this is a `Failure`.
   */
  orElse(alt: LazyArg<Try<T>>): Try<T> {
    if (this.isSuccess) return this;
    try {
      return extractLazyArg(alt);
    } catch (err) {
      return Failure(err);
    }
  }

  /**
   * Applies `fa` if this is a `Failure` or `fb` if this is a `Success`. If `fb`
   * is initially applied and throws an exception, then `fa` is applied with
   * this exception.
   *
   * ```
   * const result: Try<number> = Try(() => string.toInt)
   * console.log(result.fold(
   *   ex => "Operation failed with " + ex,
   *   v => "Operation produced value: " + v
   * ))
   * ```
   *
   * @param fa the function to apply if this is a `Failure`
   * @param fb the function to apply if this is a `Success`
   * @return the results of applying the function
   */
  abstract fold<U>(fa: (err: Error) => U, fb: (t: T) => U): U;

  /**
   * Returns `None` if this is a `Failure` or a `Some` containing the value if
   * this is a `Success`.
   */
  abstract toOption(): Option<T>;

  /**
   * Returns `Left` with `Error` if this is a `Failure`, otherwise returns
   * `Right` with `Success` value.
   */
  abstract toEither<L extends Error = Error>(): Either<L, T>;

  /**
   * Completes this `Try` by applying the function `f` to this if this is of
   * type `Failure`, or conversely, by applying `s` if this is a `Success`.
   */
  abstract transform<U>(s: (_: T) => Try<U>, f: (_: Error) => Try<U>): Try<U>;

  /**
   * Returns the given function applied to the value from this `Success` or
   * returns this if this is a `Failure`.
   */
  abstract flatMap<U>(f: (_: T) => Try<U>): Try<U>;
}

class TryFailure<T> extends TryW<T> {
  readonly isFailure = true;
  readonly isSuccess = false;

  constructor(private readonly exception: Error) {
    super();
  }

  get(): T {
    throw this.exception;
  }

  fold<U>(fa: (err: Error) => U, _fb: (t: T) => U): U {
    return fa(this.exception);
  }

  toOption(): Option<T> {
    return None;
  }

  toEither<L extends Error = Error, R = T>(): Either<L, R> {
    return Left(this.exception as L);
  }

  transform<U>(_: (_: T) => Try<U>, f: (_: Error) => Try<U>): Try<U> {
    try {
      return f(this.exception);
    } catch (err) {
      return Failure(err);
    }
  }

  flatMap<U>(_: (_: T) => Try<U>): Try<U> {
    return this as any;
  }
}

class TrySuccess<T> extends TryW<T> {
  readonly isFailure = false;
  readonly isSuccess = true;

  constructor(private readonly value: T) {
    super();
  }

  get(): T {
    return this.value;
  }

  fold<U>(fa: (_: Error) => U, fb: (_: T) => U): U {
    try {
      return fb(this.value);
    } catch (err) {
      return fa(err);
    }
  }

  toOption(): Option<T> {
    return Some(this.value);
  }

  toEither<L extends Error = Error>(): Either<L, T> {
    return Right(this.value);
  }

  transform<U>(s: (_: T) => Try<U>, _: (_: Error) => Try<U>): Try<U> {
    return this.flatMap(s);
  }

  flatMap<U>(f: (_: T) => Try<U>): Try<U> {
    try {
      return f(this.value);
    } catch (err) {
      return Failure(err);
    }
  }
}

/**
 * Returns a `TryFailure` instance of the given value.
 */
const Failure = <T>(exception: Error): Try<T> => {
  return new TryFailure<T>(exception);
};

/**
 * Returns a `TrySuccess` instance of the given value.
 */
const Success = <T>(val: T | null | undefined): Try<T> => {
  return new TrySuccess<T>(val!);
};

/**
 * Constructs a `Try` using the anonymous function parameter. This method will
 * ensure any exception is caught and a `Failure` object is returned.
 */
const Try = <T>(r: (_?: unknown) => T): Try<T> => {
  try {
    return Success(r());
  } catch (err) {
    return Failure(err);
  }
};

/**
 * Constructs a `Try` using the async anonymous function parameter. This method
 * will ensure any exception is caught and a `Failure` object is returned.
 */
const TryAsync = async <T>(r: (_?: unknown) => Promise<T>): Promise<Try<T>> => {
  try {
    return Success(await r());
  } catch (err) {
    return Failure(err);
  }
};

/**
 * Since we cannot build a `Try` object without the new keyword (case classes
 * in scala), the name `TryW` has been assigned to the class and `Try` has been
 * assigned to the function that builds a `TryW` instance. Since it would be
 * awful to declare `TryW` types we have created the alias `Try`.
 */
type Try<T> = TryW<T>;

export { TryW, TryFailure, TrySuccess, Failure, Success, Try, TryAsync };
