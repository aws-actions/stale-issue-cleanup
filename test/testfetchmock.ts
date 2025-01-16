import createFetchMock from 'vitest-fetch-mock';
import { vi } from 'vitest';

// Enable fetch mocks but don't mock by default
export default createFetchMock(vi).enableMocks().dontMock();
