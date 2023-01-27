FROM mhart/alpine-node:14.17.3

LABEL "repository"="https://github.com/aws-actions/stale-issue-cleanup"
LABEL "version"="0.1.0"

ADD package.json yarn.lock /
RUN yarn install --frozen-lockfile
COPY src /src/

ENTRYPOINT ["node", "/src/entrypoint.js"]
