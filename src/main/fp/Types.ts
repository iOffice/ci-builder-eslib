/**
 * Inspired by scala by call by name parameter
 * (https://stackoverflow.com/a/9809731)
 *
 * ```
 * def f(param: => T)
 * ```
 *
 * `param` is a "by-name" parameter, meaning that is evaluated every time it is
 * used within the body of the function, and not before. To achieve this in
 * typescript we can either provide the value or a function that returns the
 * value.
 *
 * We call it "lazy" argument since we can choose to evaluate at a later time,
 * or simply provide the value.
 */
type LazyArg<A> = A | ((_?: unknown) => A);

/**
 * Obtain the value provided by the `LazyArg` type.
 */
const extractLazyArg = <A>(param: LazyArg<A>): A => {
  return param instanceof Function ? param() : param;
};

export { LazyArg, extractLazyArg };
