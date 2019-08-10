import { Either, Left, Right } from './Either';
import { LazyArg, extractLazyArg } from './Types';

/**
 * A type to match the usage in scala.
 */
type Option<T> = OptionW<T>;

/* eslint-disable @typescript-eslint/no-use-before-define */
/**
 * Represents optional values. Instances of `Option` are either an instance of
 * `OptionSome` or the singleton `OptionNone`. Note: `Option` is a type alias
 * for the real abstract class `Optional`.
 *
 * https://github.com/scala/scala/blob/2.13.x/src/library/scala/Option.scala
 */
abstract class OptionW<A> {
  /**
   * Returns true if the option is `None`, false otherwise.
   */
  abstract readonly isEmpty: boolean;

  /**
   * Returns true if the option is an instance of `OptionSome`, false otherwise.
   */
  abstract readonly isDefined: boolean;

  /**
   * Returns the option's value.
   */
  abstract get(): A;

  /**
   * Returns the option's value if the option is nonempty, otherwise return the
   * alternative.
   */
  getOrElse(alt: LazyArg<A>): A {
    return this.isEmpty ? extractLazyArg(alt) : this.get();
  }

  /**
   * Returns this option's value if it is nonempty, otherwise it returns `null`.
   *
   * Although the use of `null` is discouraged, code written to use options must
   * often interface with code that expects and returns nulls.
   */
  orNull(): A | null {
    return this.isEmpty ? null : this.get();
  }

  /**
   * Returns this option's value if it is nonempty, otherwise it returns
   * `undefined`.
   *
   * Although the use of `undefined` is discouraged, code written to use options
   * must often interface with code that expects and returns undefined.
   */
  orUndefined(): A | undefined {
    return this.isEmpty ? undefined : this.get();
  }

  /**
   * Returns an `Option` containing the result of applying `fn` to this `Option`
   * value if it is nonempty.
   */
  map<B>(fn: (a: A) => B | null | undefined): Option<B> {
    return this.isEmpty ? None : Maybe(fn(this.get()));
  }

  /**
   * Returns the result of applying `fn` to this `Option`s value if it is
   * nonempty. Otherwise, evaluates expression `ifEmpty`.
   *
   * @note This is equivalent to `Opt.map(f).getOrElse(ifEmpty)`.
   *
   * @param ifEmpty the expression to evaluate if empty.
   * @param fn      the function to apply if nonempty.
   */
  fold<B>(ifEmpty: LazyArg<B>, fn: (a: A) => B): B {
    return this.isEmpty ? extractLazyArg(ifEmpty) : fn(this.get());
  }

  /**
   * Returns the result of applying `fn` to this `Option`'s value if it is
   * nonempty. Returns `None` if empty. Slightly different from `map` in that
   * `fn` is expected to return an `Option`.
   */
  flatMap<B>(fn: (a: A) => Option<B>): Option<B> {
    return this.isEmpty ? (None as Option<B>) : fn(this.get());
  }

  /**
   * This should only work as long as `A` is a subtype of `Opt<B>` but there is
   * no way at the moment to let Typescript know this.
   */
  flatten<B>(): Option<B> {
    return this.flatMap<B>(id => {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      return id instanceof OptionW ? id : Some<B>(id as any);
    });
  }

  /**
   * Returns this `Option` if it is nonempty and applying the predicate `fn` to
   * its value returns true. Otherwise, return `None`.
   */
  filter(fn: (a: A) => boolean): Option<A> {
    return this.isEmpty || fn(this.get()) ? this : None;
  }

  /**
   * Returns this `Option` if it is nonempty and applying the predicate `fn` to
   * its value returns false. Otherwise, return `None`.
   */
  filterNot(fn: (a: A) => boolean): Option<A> {
    return this.isEmpty || !fn(this.get()) ? this : None;
  }

  /**
   * Tests whether the option contains a given value as an element.
   */
  contains(elem: A): boolean {
    return !this.isEmpty && this.get() === elem;
  }

  /**
   * Returns true if this option is nonempty '''and''' the predicate `fn`
   * returns true when applied to this $option's value. Otherwise, returns
   * false.
   */
  exists(fn: (a: A) => boolean): boolean {
    return !this.isEmpty && fn(this.get());
  }

  /**
   * Apply the given procedure `fn` to the option's value, if it is nonempty.
   */
  forEach(fn: (a: A) => void): void {
    if (!this.isEmpty) {
      fn(this.get());
    }
  }

  /**
   * Returns this `Option` if it is nonempty. Otherwise, return the alternative
   * `Option`.
   */
  orElse(alt: LazyArg<Option<A>>): Option<A> {
    return this.isEmpty ? extractLazyArg(alt) : this;
  }

  /**
   * Returns this `Option` if it is nonempty. Otherwise, return an `Option` of
   * the alternative value.
   */
  or(alt: LazyArg<A | null | undefined>): Option<A> {
    return this.isEmpty ? Maybe(extractLazyArg(alt)) : this;
  }

  /**
   * Returns a `Left` containing the given argument `left` if this `Option` is
   * empty, or a `Right` containing this `Option`'s value if this is nonempty.
   */
  toRight<X>(left: LazyArg<X>): Either<X, A> {
    return this.isEmpty ? Left(extractLazyArg(left)) : Right(this.get());
  }

  /**
   * Returns a `Right` containing the given argument `right` if this `Option`
   * is empty, or a `Left` containing this `Option`'s value if this is nonempty.
   */
  toLeft<X>(right: LazyArg<X>): Either<A, X> {
    return this.isEmpty ? Right(extractLazyArg(right)) : Left(this.get());
  }

  /**
   * Apply the given procedure `fn` to an `Option` wrapped response from a
   * Promise or Observable. If the result from the promise was rejected then the
   * value that is wrapped will be an empty one.
   *
   * NOTE: This is not found in scala.
   */
  later<D>(fn: (a: Option<D>) => void): void {
    if (this.isEmpty) {
      fn(None);
    } else {
      const item = this.get();
      const callback = item['subscribe'] || item['then'];
      if (callback) {
        callback.call(item, (res: D) => fn(Maybe(res)), () => fn(None));
      }
    }
  }

  /**
   * When a given condition is true, evaluates the `a` argument and returns
   * Some(a). When the condition is false, `a` is not evaluated and None is
   * returned.
   */
  static when<X>(cond: boolean, a: LazyArg<X>): Option<X> {
    return cond ? Some(extractLazyArg(a)) : (None as Option<X>);
  }

  /**
   * Unless a given condition is true, this will evaluate the `a` argument and
   * return Some(a). Otherwise, `a` is not evaluated and None is returned.
   */
  static unless<X>(cond: boolean, a: LazyArg<X>): Option<X> {
    return OptionW.when(!cond, a);
  }
}

/**
 * Represents existing values of type `A`.
 */
class OptionSome<A> extends OptionW<A> {
  readonly isEmpty = false;
  readonly isDefined = true;

  /**
   * The value of the `Option` object.
   */
  protected readonly value: A;

  constructor(value: A) {
    super();
    this.value = value;
  }

  get(): A {
    return this.value;
  }
}

/**
 * This singleton represents non-existent values.
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
class OptionNone<T extends any> extends OptionW<T> {
  static readonly instance = new OptionNone();
  readonly isEmpty = true;
  readonly isDefined = false;

  private constructor() {
    super();
  }

  get(): T {
    throw new Error('None.get');
  }
}

/**
 * Returns a `OptionSome` instance of the given value. May throw an Error if a
 * null or undefined is passed. If you are not sure if what you are passing may
 * be an empty value use `Maybe` as this will either give an `OptionSome` or
 * `OptionNone`. */
const Some = <A>(val: A | null | undefined): OptionSome<A> => {
  if (val === null || val === undefined)
    throw new Error('Some(null | undefined)');
  return new OptionSome<A>(val);
};

/**
 * Alias for the `OptionNone` singleton.
 */
const None = OptionNone.instance;

/**
 * Returns an `Option` instance of the given value.
 */
const Maybe = <A>(val: A | null | undefined): Option<A> => {
  return val === null || val === undefined
    ? (None as Option<A>)
    : new OptionSome<A>(val);
};

export { Option, OptionW, OptionSome, OptionNone, Some, None, Maybe };
