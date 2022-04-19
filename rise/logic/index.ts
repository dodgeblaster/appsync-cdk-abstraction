import * as cdk from '@aws-cdk/core'
import * as appsync from '@aws-cdk/aws-appsync'
import { RiseDb } from '../resources/db'
import { DbDatasource } from '../resources/datasourceTable'
import { EventDatasource } from '../resources/datasourceEventBridge'
import { RiseResolver } from '../resources/resolver'
import { RisePipelineResolver } from '../resources/pipelineResolver'
import { RiseFunction } from '../resources/function'
import { EventToQueryResources } from '../resources/eventToMutationResources'

export class RiseApp extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: { definition: any }) {
        super(scope, id)
        const appName = props.definition.config.name

        const tableName = props.definition.config.name + '-db'

        // make api
        const api = new appsync.CfnGraphQLApi(this, 'api', {
            name: appName,
            authenticationType: 'API_KEY'
        })

        // make api key
        new appsync.CfnApiKey(this, 'api-key', {
            apiId: api.attrApiId
        })

        // make schema
        const schema = new appsync.CfnGraphQLSchema(this, 'api-schema', {
            apiId: api.attrApiId,
            definition: props.definition.schema
        })

        // make table
        new RiseDb(this, 'risedb', { name: tableName })

        // data sources
        const ds = new DbDatasource(this, 'risedbds', {
            apiId: api.attrApiId,
            region: props.definition.config.region || 'us-east-1',
            tableName
        })

        const eventds = new EventDatasource(this, 'riseevents', {
            apiId: api.attrApiId,
            region: props.definition.config.region || 'us-east-1'
        })

        // event to query resources
        const EToQ = new EventToQueryResources(this, 'etoq')

        const callGrapQLLambda = EToQ.setupResources({
            apiArn: api.attrArn
        })

        EToQ.makeEventToQueryConnection({
            bus: 'rise-cdk-bus',
            source: 'source.backend',
            detailType: 'payment-processed',
            field: 'testing',
            callGrapQLLambda,
            region: props.definition.config.region || 'us-east-1'
        })

        // Make Resolvers
        const resolverMaker = new RiseResolver(this, 'makeresolver')
        Object.keys(props.definition.resolvers.Query).forEach((k) => {
            const item = props.definition.resolvers.Query[k]
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

        const functionMaker = new RiseFunction(this, 'functionMaker')
        Object.keys(props.definition.resolvers.Mutation).forEach((k) => {
            const item = props.definition.resolvers.Mutation[k]
            if (!Array.isArray(item)) {
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
            } else {
                let functions: appsync.CfnFunctionConfiguration[] = []
                let toAdd: any = {}
                item.forEach((x, i) => {
                    if (x.type === 'add') {
                        Object.keys(x)
                            .filter((k) => k !== 'type')
                            .forEach((k) => (toAdd[k] = x[k]))
                    }
                    if (x.type === 'guard') {
                        const f = functionMaker.makeGuard({
                            schema,
                            ds: ds.get(),
                            apiId: api.attrApiId,
                            name: `m${k}guard${i}`,
                            config: {
                                pk: x.pk,
                                sk: x.sk
                            }
                        })
                        functions.push(f)
                    }
                    if (x.type === 'db') {
                        if (x.action === 'get') {
                            const f = functionMaker.makeGet({
                                schema,
                                ds: ds.get(),
                                apiId: api.attrApiId,
                                name: `m${k}dbget${i}`
                            })
                            functions.push(f)
                        }

                        if (x.action === 'list') {
                            const f = functionMaker.makeQuery({
                                schema,
                                ds: ds.get(),
                                apiId: api.attrApiId,
                                name: `m${k}dbquery${i}`
                            })
                            functions.push(f)
                        }

                        if (x.action === 'create') {
                            const f = functionMaker.makeCreate({
                                schema,
                                ds: ds.get(),
                                apiId: api.attrApiId,
                                name: `m${k}dbcreate${i}`
                            })
                            functions.push(f)
                        }

                        if (x.action === 'remove') {
                            const f = functionMaker.makeRemove({
                                schema,
                                ds: ds.get(),
                                apiId: api.attrApiId,
                                name: `m${k}dbremove${i}`
                            })
                            functions.push(f)
                        }
                    }
                    if (x.type === 'emit') {
                        const f = functionMaker.makeEventEmit({
                            schema,
                            ds: eventds.get(),
                            apiId: api.attrApiId,
                            name: `m${k}emit${i}`,
                            config: {
                                eventBus:
                                    props.definition.config.eventbus ||
                                    'default',
                                source: appName,
                                event: x.event,
                                detail: x.data
                            }
                        })
                        functions.push(f)
                    }
                })
                new RisePipelineResolver(
                    this,
                    `mutation${k}`
                ).makeMutationPipeline({
                    schema,
                    ds: ds.get(),
                    apiId: api.attrApiId,
                    field: k,
                    functions: functions,
                    config: {
                        ...toAdd
                    }
                })
            }
        })
    }
}
