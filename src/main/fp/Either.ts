import { None, Option, Some } from './Option';
import { LazyArg, extractLazyArg } from './Types';

/* eslint-disable @typescript-eslint/no-use-before-define */
/**
 * Represents a value of one of two possible types (a disjoint union.)
 * An instance of `Either` is either an instance of `EitherLeft` or
 * `EitherRight`.
 *
 * A common use of `Either` is as an alternative to `Maybe` for dealing with
 * possible missing values. In this usage, `Option.none` is replaced with a
 * `Left` which can contain useful information. `Right` takes the place of
 * `some`. Convention dictates that Left is used for failure and Right is used
 * for success.
 *
 * Ported from https://github.com/scala/scala/blob/v2.12.0/src/library/scala/util/Either.scala
 */
abstract class Either<A, B> {
  /**
   * The value of the `Either` object.
   */
  readonly value: A | B;

  /**
   * Returns `true` if this is a `Left`, `false` otherwise.
   */
  abstract readonly isLeft: boolean;

  /**
   * Returns `true` if this is a `Right`, `false` otherwise.
   */
  abstract readonly isRight: boolean;

  /**
   * Only the `Left` and `Right` classes can access the constructor.
   */
  protected constructor(value: A | B) {
    this.value = value;
  }

  /**
   * Applies `fa` if this is a `Left` or `fb` if this is a `Right`.
   *
   * @example
   * const result: Either<Exception, Value> = possiblyFailingOperation()
   * console.log(result.fold(
   *   ex => `Operation failed with ${ex}`,
   *   v  => `Operation produced value: ${v}`
   * ))
   *
   * @param fa the function to apply if this is a `Left`
   * @param fb the function to apply if this is a `Right`
   */
  fold<C>(fa: (a: A) => C, fb: (b: B) => C): C {
    return this.isRight ? fb(this.value as B) : fa(this.value as A);
  }

  /**
   * If this is a `Left`, then return the left value in `Right` or vice versa.
   *
   * const left: Either<string, number> = Left("left")
   * const right: Either<number, string> = l.swap // Result: Right("left")
   */
  swap(): Either<B, A> {
    if (this.isLeft) return Right(this.value as A);
    return Left(this.value as B);
  }

  /**
   * Executes the given side-effecting function if this is a `Right`.
   *
   * ```
   * Right(12).forEach(x => console.log(x)) // prints "12"
   * Left(12).forEach(x => console.log(x))  // doesn't print
   * ```
   *
   * @param f The side-effecting function to execute.
   */
  forEach<U>(f: (b: B) => U): void {
    if (this.isRight) {
      f(this.value as B);
    }
  }

  /**
   * Returns the value from this `Right` or the given argument if this is a
   * `Left`.
   *
   * ```
   * Right(12).getOrElse(17) // 12
   * Left(12).getOrElse(17)  // 17
   * ```
   */
  getOrElse<BB extends B>(or: LazyArg<BB>): BB {
    if (this.isRight) return this.value as BB;
    return extractLazyArg(or);
  }

  /**
   * Returns `true` if this is a `Right` and its value is equal to `elem`
   * (as determined by `===`), returns `false` otherwise.
   *
   * ```
   * // Returns true because value of Right is "something" which equals "something".
   * Right('something').contains('something')
   *
   * // Returns false because value of Right is "something" which does not equal "anything".
   * Right('something').contains('anything')
   *
   * // Returns false because there is no value for Right.
   * Left('something').contains('something')
   * ```
   */
  contains<BB extends B>(elem: BB): boolean {
    if (this.isLeft) return false;
    return this.value === elem;
  }

  /**
   * Returns `true` if `Left` or returns the result of the application of
   * the given predicate to the `Right` value.
   *
   * ```
   * Right(12).forall(x => x > 10) // true
   * Right(7).forall(x => x > 10)  // false
   * Left(12).forall(x => x > 10)  // true
   * ```
   */
  forAll(f: (b: B) => boolean): boolean {
    if (this.isLeft) return true;
    return f(this.value as B);
  }

  /**
   * Returns `false` if `Left` or returns the result of the application of
   * the given predicate to the `Right` value.
   *
   * ```
   * Right(12).exists(x => x > 10) // true
   * Right(7).exists(x => x > 10)  // false
   * Left(12).exists(x => x > 10)  // false
   * ```
   */
  exists(p: (b: B) => boolean): boolean {
    return this.isRight ? p(this.value as B) : false;
  }

  /**
   * Binds the given function across `Right`.
   *
   * @param f The function to bind across `Right`.
   */
  flatMap<AA, Y>(f: (b: B) => Either<AA, Y>): Either<AA, Y> {
    // No way to tell the compiler that this is ok as long as A extends AA.
    return this.isRight
      ? f(this.value as B)
      : ((this as unknown) as Either<AA, Y>);
  }

  /**
   * Returns the right value if this is right or this value if this is left
   *
   * ```
   * const  l: Either<string, Either<string, number>> = Left("pancake")
   * const rl: Either<string, Either<string, number>> = Right(Left("flounder"))
   * const rr: Either<string, Either<string, number>> = Right(Right(7))
   *
   *  l.flatten() //Either<string, number>> Left("pancake")
   * rl.flatten() //Either<string, number>> Left("flounder")
   * rr.flatten() //Either<string, number>> Right(7)
   * ```
   *
   * Equivalent to `flatMap(id => id)`
   */
  flatten<A1, B1>(): Either<A1, B1> {
    return this.flatMap(id => (id as unknown) as Either<A1, B1>);
  }

  /**
   * The given function is applied if this is a `Right`.
   *
   * ```
   * Right(12).map(x => "flower") // Result: Right("flower")
   * Left(12).map(x => "flower")  // Result: Left(12)
   * ```
   */
  map<Y>(f: (b: B) => Y): Either<A, Y> {
    return this.isRight
      ? Right(f(this.value as B))
      : ((this as unknown) as Either<A, Y>);
  }

  /**
   * Returns `Right` with the existing value of `Right` if this is a `Right` and
   * the given predicate `p` holds for the right value,
   *
   * returns `Left(zero)` if this is a `Right` and the given predicate `p` does
   * not hold for the right value,
   *
   * returns `Left` with the existing value of `Left` if this is a `Left`.
   *
   * ```
   * Right(12).filterOrElse(x => x > 10, -1) // Right(12)
   * Right(7).filterOrElse(x => x > 10, -1)  // Left(-1)
   * Left(12).filterOrElse(x => x > 10, -1)  // Left(12)
   * ```
   */
  filterOrElse<AA>(p: (b: B) => boolean, zero: LazyArg<AA>): Either<AA, B> {
    if (this.isRight) {
      if (p(this.value as B)) {
        return (this as unknown) as Either<AA, B>;
      }
      return Left(extractLazyArg(zero));
    }
    return (this as unknown) as Either<AA, B>;
  }

  /**
   * Returns an array containing the `Right` value if it exists or an empty
   * array if this is a `Left`.
   *
   * ```
   * Right(12).toArray() // [12]
   * Left(12).toArray()  // []
   * ```
   */
  toArray(): B[] {
    return this.isRight ? [this.value as B] : [];
  }

  toOption(): Option<B> {
    return this.isRight ? Some(this.value as B) : None;
  }

  /**
   * If the condition is satisfied, return the given `B` in `Right`,
   * otherwise, return the given `A` in `Left`.
   *
   * ```
   * const userInput: string = ...
   * Either.cond(
   *   Array.from(userInput).every(x => '0123456789'.includes(x)) && userInput.length === 10,
   *   new PhoneNumber(userInput),
   *   `The input (${userInput}) does not look like a phone number`,
   * )
   * ```
   */
  static cond<X, Y>(
    test: boolean,
    right: LazyArg<Y>,
    left: LazyArg<X>,
  ): Either<X, Y> {
    return test ? Right(extractLazyArg(right)) : Left(extractLazyArg(left));
  }
}

class EitherLeft<A, B> extends Either<A, B> {
  readonly isLeft = true;
  readonly isRight = false;

  constructor(value: A) {
    super(value);
  }
}

class EitherRight<A, B> extends Either<A, B> {
  readonly isLeft = false;
  readonly isRight = true;

  constructor(value: B) {
    super(value);
  }
}

/**
 * Returns a `EitherLeft` instance of the given value.
 */
const Left = <A, B>(val: A | null | undefined): EitherLeft<A, B> => {
  return new EitherLeft<A, B>((val as unknown) as A);
};

/**
 * Returns a `EitherRight` instance of the given value.
 */
const Right = <A, B>(val: B | null | undefined): EitherRight<A, B> => {
  return new EitherRight<A, B>((val as unknown) as B);
};

export { Either, EitherLeft, EitherRight, Left, Right };
