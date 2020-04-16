FROM mhart/alpine-node:12

LABEL "repository"="https://github.com/aws-actions/stale-issue-cleanup"
LABEL "version"="0.1.0"

ADD package.json yarn.lock /
RUN yarn install --frozen-lockfile
ADD entrypoint.js /

ENTRYPOINT ["node", "/entrypoint.js"]
