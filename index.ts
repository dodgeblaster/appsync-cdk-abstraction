import * as cdk from '@aws-cdk/core'
import * as appsync from '@aws-cdk/aws-appsync'
import { RiseDb } from './rise/db'
import { DbDatasource } from './rise/datasourceTable'
import { RiseResolver } from './rise/resolver'

const definition = {
    api: `
        type Note {
            PK: String
            SK: String
            name: String
        }

        input NoteInput {
            PK: String
            SK: String
            name: String 
        }
        
        type Query {
            notes: [Note]
        }

        type Mutation {
            createNote(input: NoteInput): Note
            removeNote(PK: String, SK: String): Note
        }
    `,
    code: {
        Query: {
            notes: {
                type: 'db',
                action: 'list',
                pk: 'notes',
                sk: 'note_'
            }
        },
        Mutation: {
            createNote: {
                type: 'db',
                action: 'create'
            },
            removeNote: {
                type: 'db',
                action: 'remove'
            }
        }
    }
}

export class AppsyncCdkStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: { definition: any }) {
        super(scope, id)

        const tableName = 'note'

        // make api
        const api = new appsync.CfnGraphQLApi(this, 'api', {
            name: 'cdk-api',
            authenticationType: 'API_KEY'
        })

        // make api key
        new appsync.CfnApiKey(this, 'api-key', {
            apiId: api.attrApiId
        })

        // make schema
        const schema = new appsync.CfnGraphQLSchema(this, 'api-schema', {
            apiId: api.attrApiId,
            definition: props.definition.api
        })

        // make table
        new RiseDb(this, 'risedb', { name: tableName })

        // data source
        const ds = new DbDatasource(this, 'risedbds', {
            apiId: api.attrApiId,
            region: this.region,
            tableName
        })

        // Make Resolvers
        const resolverMaker = new RiseResolver(this, 'makeresolver')
        Object.keys(props.definition.code.Query).forEach((k) => {
            const item = props.definition.code.Query[k]
            resolverMaker.makeQuery({
                schema,
                ds: ds.get(),
                apiId: api.attrApiId,
                field: k,
                config: {
                    pk: item.pk,
                    sk: item.sk
                }
            })
        })

        Object.keys(props.definition.code.Mutation).forEach((k) => {
            const item = props.definition.code.Mutation[k]
            if (item.action === 'create') {
                resolverMaker.makeCreate({
                    schema,
                    ds: ds.get(),
                    apiId: api.attrApiId,
                    field: k
                })
            }
            if (item.action === 'remove') {
                resolverMaker.makeRemove({
                    schema,
                    ds: ds.get(),
                    apiId: api.attrApiId,
                    field: k
                })
            }
        })
    }
}

const app = new cdk.App()
new AppsyncCdkStack(app, 'RiseCdkStack', { definition })
