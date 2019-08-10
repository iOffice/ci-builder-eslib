import { SinonSandbox } from 'sinon';

const mockMethods = <T extends Record<string, unknown>>(
  objectToMock: T,
  defaultMockValuesForMock: Partial<{ [K in keyof T]: T[K] }>,
): ((
  sandbox: SinonSandbox,
  returnOverrides?: Partial<{ [K in keyof T]: T[K] }>,
) => void) => {
  return (
    sandbox: SinonSandbox,
    returnOverrides?: Partial<{ [K in keyof T]: T[K] }>,
  ): void => {
    const functions = Object.keys(objectToMock);
    const returns = returnOverrides || {};
    functions.forEach(f => {
      sandbox
        .stub(objectToMock, f)
        .callsFake(returns[f] || defaultMockValuesForMock[f]);
    });
  };
};

export { mockMethods };
