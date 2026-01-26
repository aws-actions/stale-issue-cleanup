"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLabeled = isLabeled;
exports.revCompareEventsByDate = revCompareEventsByDate;
exports.getLastLabelTime = getLastLabelTime;
exports.getLastCommentTime = getLastCommentTime;
exports.asyncForEach = asyncForEach;
exports.dateFormatToIsoUtc = dateFormatToIsoUtc;
exports.parseCommaSeparatedString = parseCommaSeparatedString;
const core = __importStar(require("@actions/core"));
const dateformat_1 = __importDefault(require("dateformat"));
function isLabeled(issue, label) {
    if ('labels' in issue) {
        const foundone = issue.labels.some((labelObj) => {
            if (typeof labelObj === 'string') {
                return labelObj === label;
            }
            return labelObj.name === label;
        });
        if (foundone) {
            core.debug(`issue has label ${label}`);
        }
        else {
            core.debug(`issue doesn't have label ${label}`);
        }
        return foundone;
    }
    core.debug(`no labels detail in #${issue}`);
    return false;
}
function revCompareEventsByDate(a, b) {
    if ('created_at' in a && 'created_at' in b) {
        const dateA = Date.parse(a.created_at);
        const dateB = Date.parse(b.created_at);
        if (dateA < dateB) {
            return 1;
        }
        if (dateA === dateB) {
            return 0;
        }
        return -1;
    }
    return 0;
}
function getLastLabelTime(events, label) {
    const labelEvents = events.filter((event) => event.event === 'labeled');
    const searchedLabelEvents = labelEvents.filter((event) => {
        if ('label' in event) {
            return event.label.name === label;
        }
        return false;
    });
    const validLabelEvents = searchedLabelEvents.filter((event) => {
        return 'created_at' in event;
    });
    if (validLabelEvents.length > 0) {
        validLabelEvents.sort(revCompareEventsByDate);
        return new Date(Date.parse(validLabelEvents[0].created_at));
    }
    core.info(`Could not find a ${label} label event in this issue's timeline. Was this label renamed?`);
    return undefined;
}
function getLastCommentTime(events) {
    const commentEvents = events.filter((event) => event.event === 'commented');
    if (commentEvents.length > 0) {
        core.debug('issue has comments');
        commentEvents.sort(revCompareEventsByDate);
        if ('created_at' in commentEvents[0]) {
            return new Date(Date.parse(commentEvents[0].created_at));
        }
    }
    // No comments on issue, so use *all events*
    core.debug('issue has no comments');
    events.sort(revCompareEventsByDate);
    if ('created_at' in events[0]) {
        return new Date(Date.parse(events[0].created_at));
    }
    return undefined;
}
function asyncForEach(_array, _callback) {
    throw new Error('Use Promise.all or Promise.allSettled instead');
}
function dateFormatToIsoUtc(dateTime) {
    return (0, dateformat_1.default)(dateTime, 'isoUtcDateTime');
}
function parseCommaSeparatedString(s) {
    if (!s.length)
        return [];
    return s.split(',').map((e) => e.trim());
}
//# sourceMappingURL=utils.js.map