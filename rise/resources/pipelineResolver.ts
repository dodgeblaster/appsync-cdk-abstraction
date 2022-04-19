import * as cdk from '@aws-cdk/core'
import * as appsync from '@aws-cdk/aws-appsync'

type QueryConfig = {
    pk?: string
    sk: string
    pk2?: string
    pk3?: string
}

export class RisePipelineResolver extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string) {
        super(scope, id)
    }

    makeQueryPipeline(props: {
        schema: appsync.CfnGraphQLSchema
        ds: appsync.CfnDataSource
        apiId: string
        field: string
        functions: string[]
        config: QueryConfig
    }) {
        const resolver = new appsync.CfnResolver(
            this,
            `QueryPipeline${props.field}`,
            {
                apiId: props.apiId,
                typeName: 'Query',
                fieldName: props.field,
                kind: 'PIPELINE',
                pipelineConfig: {
                    functions: props.functions
                },
                dataSourceName: props.ds.name,
                requestMappingTemplate: `
                    $util.qr($ctx.stash.put("input", $ctx.args))
                    {}
                `,
                responseMappingTemplate: `
                #if($ctx.stash.dbresult)
                  $util.toJson($ctx.stash.dbresult)
                    
                #else
                    $util.error("event branch")
                    $ctx.stash.eventresult
                #end
                `
            }
        )
        resolver.addDependsOn(props.ds)
        resolver.addDependsOn(props.schema)
    }

    makeGetPipeline(props: {
        schema: appsync.CfnGraphQLSchema
        ds: appsync.CfnDataSource
        apiId: string
        field: string
        functions: string[]
        config: QueryConfig
    }) {
        const resolver = new appsync.CfnResolver(
            this,
            `QueryPipeline${props.field}`,
            {
                apiId: props.apiId,
                typeName: 'Query',
                fieldName: props.field,
                kind: 'PIPELINE',
                pipelineConfig: {
                    functions: props.functions
                },
                dataSourceName: props.ds.name,
                requestMappingTemplate: `
                    $util.qr($ctx.stash.put("input", $ctx.args))
                    {}
                `,
                responseMappingTemplate: `
                #if($ctx.stash.dbresult)
                  $util.toJson($ctx.stash.dbresult)
                    
                #else
                    $util.error("event branch")
                    $ctx.stash.eventresult
                #end
                `
            }
        )
        resolver.addDependsOn(props.ds)
        resolver.addDependsOn(props.schema)
    }

    makeMutationPipeline(props: {
        schema: appsync.CfnGraphQLSchema
        ds: appsync.CfnDataSource
        apiId: string
        field: string
        functions: appsync.CfnFunctionConfiguration[]
        config: Record<string, string>
    }) {
        let requestTemplate = `$util.qr($ctx.stash.put("input", $ctx.args.input))`
        Object.keys(props.config).forEach((k: string) => {
            let value = props.config[k]

            if (value.startsWith('$')) {
                value = value.replace('$', '$ctx.args.input.')
            } else {
                value = `"${value}"`
            }

            if (value.includes('@id')) {
                requestTemplate =
                    requestTemplate +
                    `$util.qr($ctx.stash.input.put("${k}", $util.str.toReplace(${value}, "@id", $util.autoId()))) `
            } else {
                requestTemplate =
                    requestTemplate +
                    `$util.qr($ctx.stash.input.put("${k}", ${value})) `
            }
        })

        requestTemplate = requestTemplate + `\n {}`

        const resolver = new appsync.CfnResolver(
            this,
            `MutationPipeline${props.field}`,
            {
                apiId: props.apiId,
                typeName: 'Mutation',
                fieldName: props.field,
                kind: 'PIPELINE',
                pipelineConfig: {
                    functions: props.functions.map((x) => x.attrFunctionId)
                },

                requestMappingTemplate: requestTemplate,
                responseMappingTemplate: `
                #if($ctx.stash.dbresult)
                  $util.toJson($ctx.stash.dbresult)   
                #else
                    $util.toJson($ctx.args)
                    ## $ctx.stash.eventresult
                #end
                `
            }
        )
        props.functions.forEach((x) => {
            resolver.addDependsOn(x)
        })
        resolver.addDependsOn(props.ds)
        resolver.addDependsOn(props.schema)
    }
}
