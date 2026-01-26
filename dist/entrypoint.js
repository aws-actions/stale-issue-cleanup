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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAndValidateInputs = getAndValidateInputs;
exports.processIssues = processIssues;
exports.run = run;
// Test comment in entrypoint.ts
const core = __importStar(require("@actions/core"));
const core_1 = require("@actions/core");
const github = __importStar(require("@actions/github"));
const github_1 = require("./github");
const utils_1 = require("./utils");
const MS_PER_DAY = 86400000;
const getRequiredInput = (name) => core.getInput(name, { required: true });
const getNumberInput = (name) => Number.parseFloat(core.getInput(name));
const getOptionalBooleanInput = (name) => core.getInput(name, { required: false }).toLowerCase() === 'true';
function getAndValidateInputs() {
    const args = {
        repoToken: getRequiredInput('repo-token'),
        ancientIssueMessage: (0, core_1.getInput)('ancient-issue-message'),
        ancientPrMessage: (0, core_1.getInput)('ancient-pr-message'),
        staleIssueMessage: (0, core_1.getInput)('stale-issue-message'),
        stalePrMessage: (0, core_1.getInput)('stale-pr-message'),
        daysBeforeStale: getNumberInput('days-before-stale'),
        daysBeforeClose: getNumberInput('days-before-close'),
        daysBeforeAncient: getNumberInput('days-before-ancient'),
        staleIssueLabel: (0, core_1.getInput)('stale-issue-label'),
        exemptIssueLabels: (0, core_1.getInput)('exempt-issue-labels'),
        stalePrLabel: (0, core_1.getInput)('stale-pr-label'),
        exemptPrLabels: (0, core_1.getInput)('exempt-pr-labels'),
        cfsLabel: (0, core_1.getInput)('closed-for-staleness-label'),
        issueTypes: (0, core_1.getInput)('issue-types').split(','),
        responseRequestedLabel: (0, core_1.getInput)('response-requested-label'),
        minimumUpvotesToExempt: getNumberInput('minimum-upvotes-to-exempt'),
        dryrun: getOptionalBooleanInput('dry-run'),
        useCreatedDateForAncient: getOptionalBooleanInput('use-created-date-for-ancient'),
    };
    for (const numberInput of [args.daysBeforeAncient, args.daysBeforeClose, args.daysBeforeStale]) {
        if (Number.isNaN(numberInput)) {
            throw Error(`input ${numberInput} did not parse to a valid integer`);
        }
    }
    return args;
}
async function processIssues(client, args) {
    const uniqueIssues = await (0, github_1.getIssues)(client, args);
    for await (const _ of uniqueIssues.map(async (issue) => {
        core.debug('==================================================');
        core.debug(`ISSUE #${issue.number}: ${issue.title}`);
        core.debug(`last updated ${issue.updated_at}`);
        const isPr = 'pull_request' in issue;
        const skipPullRequests = args.issueTypes.indexOf('pull_requests') === -1;
        const skipIssues = args.issueTypes.indexOf('issues') === -1;
        if (isPr && skipPullRequests) {
            // If record is a pull request but pull requests weren't configured
            core.debug('Issue is a pull request, which are excluded');
            return;
        }
        if (!isPr && skipIssues) {
            // If record is an issue but issues weren't configured
            core.debug('Issue is an issue, which are excluded');
            return;
        }
        const staleMessage = isPr ? args.stalePrMessage : args.staleIssueMessage;
        const ancientMessage = isPr ? args.ancientPrMessage : args.ancientIssueMessage;
        const staleLabel = isPr ? args.stalePrLabel : args.staleIssueLabel;
        const exemptLabels = (0, utils_1.parseCommaSeparatedString)(isPr ? args.exemptPrLabels : args.exemptIssueLabels);
        const responseRequestedLabel = isPr ? args.responseRequestedLabel : args.responseRequestedLabel;
        const issueTimelineEvents = await (0, github_1.getTimelineEvents)(client, issue);
        const currentTime = new Date(Date.now());
        if (exemptLabels?.some((s) => (0, utils_1.isLabeled)(issue, s))) {
            // If issue contains exempt label, do nothing
            core.debug('issue contains exempt label');
            return;
        }
        if ((0, utils_1.isLabeled)(issue, staleLabel)) {
            core.debug('issue contains the stale label');
            const commentTime = (0, utils_1.getLastCommentTime)(issueTimelineEvents);
            const lastCommentTime = commentTime ? commentTime.getTime() : 0;
            const staleLabelTime = (0, utils_1.getLastLabelTime)(issueTimelineEvents, staleLabel)?.getTime();
            const sTime = new Date(lastCommentTime + MS_PER_DAY * args.daysBeforeClose);
            // This happens when we can't determine the time of labeling stale
            // but GitHub told us it has a stale label on it.
            if (staleLabelTime === undefined) {
                core.warning('Skipping this issue');
                return;
            }
            if (lastCommentTime > staleLabelTime) {
                core.debug('issue was commented on after the label was applied');
                if (args.dryrun) {
                    core.info(`dry run: would remove ${staleLabel} and ${responseRequestedLabel} labels for #${issue.number}`);
                }
                else {
                    await (0, github_1.removeLabel)(client, issue, staleLabel);
                    if ((0, utils_1.isLabeled)(issue, responseRequestedLabel)) {
                        await (0, github_1.removeLabel)(client, issue, responseRequestedLabel);
                    }
                }
            }
            else {
                if (currentTime > sTime) {
                    core.debug('time expired on this issue, need to close it');
                    if (args.dryrun) {
                        core.info(`dry run: would remove ${staleLabel} for #${issue.number} and close`);
                    }
                    else {
                        await (0, github_1.removeLabel)(client, issue, staleLabel);
                        await (0, github_1.closeIssue)(client, issue, args.cfsLabel);
                    }
                }
                else {
                    // else ignore it because we need to wait longer before closing
                    core.debug(`${(0, utils_1.dateFormatToIsoUtc)(currentTime)} is less than ${(0, utils_1.dateFormatToIsoUtc)(sTime)}, doing nothing`);
                }
            }
        }
        else if ((0, utils_1.isLabeled)(issue, responseRequestedLabel)) {
            // const lastCommentTime = getLastCommentTime(issueTimelineEvents);
            const commentTime = (0, utils_1.getLastCommentTime)(issueTimelineEvents);
            const lastCommentTime = commentTime ? commentTime.getTime() : 0;
            const rrLabelTime = (0, utils_1.getLastLabelTime)(issueTimelineEvents, responseRequestedLabel);
            const rrLabelTimeMilliseconds = rrLabelTime ? rrLabelTime.getTime() : 0;
            const rrTime = new Date(lastCommentTime + MS_PER_DAY * args.daysBeforeStale);
            if (lastCommentTime > rrLabelTimeMilliseconds) {
                core.debug('issue was commented on after the label was applied');
                if (args.dryrun) {
                    core.info(`dry run: would remove ${responseRequestedLabel} from #${issue.number}`);
                }
                else {
                    await (0, github_1.removeLabel)(client, issue, responseRequestedLabel);
                }
            }
            else {
                if (currentTime >= rrTime) {
                    if (staleMessage && staleMessage !== '') {
                        core.debug('time expired on this issue, need to label it stale');
                        if (args.dryrun) {
                            core.info(`dry run: would mark #${issue.number} as ${staleLabel} due to ${responseRequestedLabel} age`);
                        }
                        else {
                            await (0, github_1.markStale)(client, issue, staleMessage, staleLabel);
                        }
                    }
                    else {
                        core.debug('stale message is null/empty, doing nothing');
                    }
                }
                else {
                    // else ignore it because we need to wait longer before staleing
                    core.debug('issue is not stale yet');
                    core.debug(`${(0, utils_1.dateFormatToIsoUtc)(currentTime)} is less than ${(0, utils_1.dateFormatToIsoUtc)(rrTime)}, doing nothing`);
                }
            }
        }
        else {
            const dateToCompare = args.useCreatedDateForAncient ? Date.parse(issue.created_at) : Date.parse(issue.updated_at);
            core.debug(`using issue ${args.useCreatedDateForAncient ? 'created date' : 'last updated'} to determine if the issue is ancient.`);
            if (dateToCompare < new Date(Date.now() - MS_PER_DAY * args.daysBeforeAncient).getTime()) {
                if (typeof args.minimumUpvotesToExempt !== 'undefined') {
                    if (await (0, github_1.hasEnoughUpvotes)(client, issue.number, args.minimumUpvotesToExempt)) {
                        core.debug('issue is ancient but has enough upvotes to exempt');
                    }
                    else {
                        core.debug('issue is ancient and not enough upvotes; marking stale');
                        if (ancientMessage && ancientMessage !== '') {
                            if (args.dryrun) {
                                core.info(`dry run: would mark #${issue.number} as ${staleLabel} due to ${args.useCreatedDateForAncient ? 'created date' : 'last updated'} age`);
                            }
                            else {
                                await (0, github_1.markStale)(client, issue, ancientMessage, staleLabel);
                            }
                        }
                        else {
                            core.debug('ancient message is null/empty, doing nothing');
                        }
                    }
                }
                else {
                    core.debug('issue is ancient and not enough upvotes; marking stale');
                    if (ancientMessage && ancientMessage !== '') {
                        if (args.dryrun) {
                            core.info(`dry run: would mark #${issue.number} as ${staleLabel} due to ${args.useCreatedDateForAncient ? 'created date' : 'last updated'} age`);
                        }
                        else {
                            await (0, github_1.markStale)(client, issue, ancientMessage, staleLabel);
                        }
                    }
                    else {
                        core.debug('ancient message is null/empty, doing nothing');
                    }
                }
            }
        }
    }))
        ;
}
async function run(fetchImpl) {
    try {
        core.info('Starting issue processing');
        const args = getAndValidateInputs();
        core.debug(JSON.stringify(args, null, 2));
        const client = github.getOctokit(args.repoToken, { request: { fetch: fetchImpl || globalThis.fetch } });
        await processIssues(client, args);
        core.info('Labelled issue processing complete');
        process.exitCode = 0;
    }
    catch (e) {
        core.error(`failed to run action: ${e}`);
        process.exitCode = 1;
    }
}
if (require.main === module) {
    run();
}
//# sourceMappingURL=entrypoint.js.map