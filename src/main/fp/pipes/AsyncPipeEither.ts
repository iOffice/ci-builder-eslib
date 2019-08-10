import { Either } from '../Either';

type Step<V, E, T> = (values: V) => Either<E, T> | Promise<Either<E, T>>;

function asyncPipeEither<L extends Error, R1>(
  f1: Step<[], L, R1>,
): Promise<Either<L, R1>>;

function asyncPipeEither<L extends Error, R1, R2>(
  f1: Step<[], L, R1>,
  f2: Step<[R1], L, R2>,
): Promise<Either<L, R2>>;

function asyncPipeEither<L extends Error, R1, R2, R3>(
  f1: Step<[], L, R1>,
  f2: Step<[R1], L, R2>,
  f3: Step<[R1, R2], L, R3>,
): Promise<Either<L, R3>>;

function asyncPipeEither<L extends Error, R1, R2, R3, R4>(
  f1: Step<[], L, R1>,
  f2: Step<[R1], L, R2>,
  f3: Step<[R1, R2], L, R3>,
  f4: Step<[R1, R2, R3], L, R4>,
): Promise<Either<L, R4>>;

function asyncPipeEither<L extends Error, R1, R2, R3, R4, R5>(
  f1: Step<[], L, R1>,
  f2: Step<[R1], L, R2>,
  f3: Step<[R1, R2], L, R3>,
  f4: Step<[R1, R2, R3], L, R4>,
  f5: Step<[R1, R2, R3, R4], L, R5>,
): Promise<Either<L, R5>>;

function asyncPipeEither<L extends Error, R1, R2, R3, R4, R5, R6>(
  f1: Step<[], L, R1>,
  f2: Step<[R1], L, R2>,
  f3: Step<[R1, R2], L, R3>,
  f4: Step<[R1, R2, R3], L, R4>,
  f5: Step<[R1, R2, R3, R4], L, R5>,
  f6: Step<[R1, R2, R3, R4, R5], L, R6>,
): Promise<Either<L, R6>>;

function asyncPipeEither<L extends Error, R1, R2, R3, R4, R5, R6, R7>(
  f1: Step<[], L, R1>,
  f2: Step<[R1], L, R2>,
  f3: Step<[R1, R2], L, R3>,
  f4: Step<[R1, R2, R3], L, R4>,
  f5: Step<[R1, R2, R3, R4], L, R5>,
  f6: Step<[R1, R2, R3, R4, R5], L, R6>,
  f7: Step<[R1, R2, R3, R4, R5, R6], L, R7>,
): Promise<Either<L, R7>>;

function asyncPipeEither<L extends Error, R1, R2, R3, R4, R5, R6, R7, R8>(
  f1: Step<[], L, R1>,
  f2: Step<[R1], L, R2>,
  f3: Step<[R1, R2], L, R3>,
  f4: Step<[R1, R2, R3], L, R4>,
  f5: Step<[R1, R2, R3, R4], L, R5>,
  f6: Step<[R1, R2, R3, R4, R5], L, R6>,
  f7: Step<[R1, R2, R3, R4, R5, R6], L, R7>,
  f8: Step<[R1, R2, R3, R4, R5, R6, R7], L, R8>,
): Promise<Either<L, R8>>;

async function asyncPipeEither<V, E, T>(
  ...items: Step<V, E, T>[]
): Promise<Either<E, T>> {
  let index = 0;
  let current: Either<E, T>;
  const values: unknown[] = [];
  let foundError = false;

  do {
    const entry = items[index];
    const entryEvaluated = entry((values as unknown) as V);
    if (entryEvaluated instanceof Promise) {
      current = await entryEvaluated;
    } else {
      current = entryEvaluated;
    }

    if (current.isLeft) {
      foundError = true;
    } else {
      values.push(current.value);
    }
    index += 1;
  } while (!foundError && index < items.length);
  return current;
}

export { asyncPipeEither };
