// This file has been replaced by heartbeatService.ts.
// socketService.ts was renamed because it never actually used WebSockets —
// it was always just HTTP polling, so the name was misleading.
//
// You can delete this file. It's only here as a safety net during the transition.

export { heartbeatService as socketService } from './heartbeatService';
