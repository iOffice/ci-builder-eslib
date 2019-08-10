import { Some, None, Option } from './Option';

type Tuple<T, U> = [T, (_?: unknown) => U];
type Constructor<T> = { new (): T };
type TypedTuple<B, U> = [Constructor<B>, (val: B) => U];

const match = <T, U>(value: T, ...options: Tuple<T, U>[]): Option<U> => {
  for (let entry of options) {
    if (entry[0] === value) return Some(entry[1]());
  }
  return None;
};

const ifElseChain = <A>(
  ...options: [boolean, (_?: unknown) => A][]
): Option<A> => {
  for (let entry of options) {
    if (entry[0]) return Some(entry[1]());
  }
  return None;
};

function matchType<V, U, T1>(value: V, case1: TypedTuple<T1, U>): Option<U>;

function matchType<V, U, T1, T2>(
  value: V,
  case1: TypedTuple<T1, U>,
  case2: TypedTuple<T2, U>,
): Option<U>;

function matchType<V, U, T1, T2, T3>(
  value: V,
  case1: TypedTuple<T1, U>,
  case2: TypedTuple<T2, U>,
  case3: TypedTuple<T3, U>,
): Option<U>;

function matchType<V, U, T1, T2, T3, T4>(
  value: V,
  case1: TypedTuple<T1, U>,
  case2: TypedTuple<T2, U>,
  case3: TypedTuple<T3, U>,
  case4: TypedTuple<T4, U>,
): Option<U>;

function matchType<V, U, T1, T2, T3, T4, T5>(
  value: V,
  case1: TypedTuple<T1, U>,
  case2: TypedTuple<T2, U>,
  case3: TypedTuple<T3, U>,
  case4: TypedTuple<T4, U>,
  case5: TypedTuple<T5, U>,
): Option<U>;

function matchType<V, U, T1, T2, T3, T4, T5, T6>(
  value: V,
  case1: TypedTuple<T1, U>,
  case2: TypedTuple<T2, U>,
  case3: TypedTuple<T3, U>,
  case4: TypedTuple<T4, U>,
  case5: TypedTuple<T5, U>,
  case6: TypedTuple<T6, U>,
): Option<U>;

function matchType<B, U, T>(
  value: T,
  ...options: TypedTuple<B, U>[]
): Option<U> {
  for (let entry of options) {
    if (value instanceof ((entry[0] as unknown) as Function)) {
      return Some(entry[1]((value as unknown) as B));
    }
  }
  return None;
}

export { Tuple, TypedTuple, Constructor, match, ifElseChain, matchType };
