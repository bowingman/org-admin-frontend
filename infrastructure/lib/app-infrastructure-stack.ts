import * as cdk from '@aws-cdk/core';
import {Bucket, BucketAccessControl} from '@aws-cdk/aws-s3';
import * as s3Deploy from '@aws-cdk/aws-s3-deployment';
import { HostedZone, ARecord, RecordTarget, PublicHostedZone } from '@aws-cdk/aws-route53';
import { CloudFrontTarget} from '@aws-cdk/aws-route53-targets';
import { DnsValidatedCertificate, CertificateValidation, CfnCertificate } from '@aws-cdk/aws-certificatemanager'
import {Distribution, AllowedMethods, CachePolicy, CachedMethods, ViewerProtocolPolicy} from '@aws-cdk/aws-cloudfront'
import * as CFOrigin from '@aws-cdk/aws-cloudfront-origins'
import { join } from 'path';
import { CfnOutput, Duration, RemovalPolicy } from '@aws-cdk/core';


export interface AppInfrastructureStackProps extends cdk.StackProps {
  publicHostedZone?: PublicHostedZone
  bucketName: string
  version: string
}

export class AppInfrastructureStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: AppInfrastructureStackProps) {
    super(scope, id, props);

    // Resources:
    // Log aggregation bucket (CloudFront logs go here)
    const logsBucket = new Bucket(this, 'helm-organizer-logs-bucket', {
      accessControl: BucketAccessControl.LOG_DELIVERY_WRITE,
      removalPolicy: cdk.RemovalPolicy.RETAIN // Keep server logs in the event that the stack gets deleted
    })

    // Site bucket (build artifacts get uploaded here)
    const siteBucket = new Bucket(this, 'helm-organizer-site-bucket', {
      bucketName: props.bucketName,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      enforceSSL: true,
      publicReadAccess: false,
      serverAccessLogsBucket: logsBucket,
      versioned: true
    });

    // Uploads angular build output to S3, prefixed with the version tag for the deploy
    const siteUpload = new s3Deploy.BucketDeployment(this, 'helm-organizer-frontend-site-upload', {
      destinationBucket: siteBucket,
      sources: [s3Deploy.Source.asset(join(__dirname, "../../dist/organizer-front"),
        {
          exclude: ['index.html']
        }
      )],
      prune: false, // Don't delete existing files when uploading
      memoryLimit: 1024,
      destinationKeyPrefix: props.version
    });

    // Upload index.html to the bucket root, once the site's been deployed.
    const indexUpload = new s3Deploy.BucketDeployment(this, 'RootDocumentUpload', {
      destinationBucket: siteBucket,
      sources: [s3Deploy.Source.asset(join(__dirname, "../../dist/organizer-front"),
        {
          exclude: ['**', '!index.html']
        }
      )],
      cacheControl: [s3Deploy.CacheControl.fromString('max-age=0,no-cache,no-store,must-revalidate')], // Browsers should not cache index.html.
      prune: false
    });

    indexUpload.node.addDependency(siteUpload)

    // ACM certificate for use with cloudfront
    const publicHostedZone = props.publicHostedZone ? HostedZone.fromHostedZoneAttributes(this, 'helm-organizer-frontend-hosted-zone-lookup', {
      hostedZoneId: props.publicHostedZone.hostedZoneId,
      zoneName: props.publicHostedZone.zoneName
    }) : undefined

    let cert;
    if ( publicHostedZone !== undefined ){
      cert = new DnsValidatedCertificate(this, 'helm-frontend-certificate', {
        domainName: publicHostedZone.zoneName,
        hostedZone: publicHostedZone,
        region: 'us-east-1', // Required by cloudfront
        validation: CertificateValidation.fromDns(publicHostedZone)
      })
      const cfnCert = cert.node.tryFindChild('CertificateRequestorResource') as CfnCertificate;
      cfnCert.applyRemovalPolicy(RemovalPolicy.DESTROY);
    }

    // Configure CloudFront to request files from the site bucket
    // The angular app will determine the prefix to request files from
    const origin = new CFOrigin.S3Origin(siteBucket,{
      originPath: `/`
    });

    const cdnCnames = publicHostedZone !== undefined ? [publicHostedZone.zoneName] : undefined;

    // Cloudfront CDN
    const cdn = new Distribution(this, 'helm-organizer-cdn', {
      enableLogging: true,
      logBucket: logsBucket,
      certificate: cert,
      domainNames:  cdnCnames,
      logFilePrefix: `organizer-frontend/`,
      defaultBehavior: {
        origin: origin,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: new CachePolicy(this, 'helm-organizer-default-cache-policy', {}),
        cachedMethods: CachedMethods.CACHE_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS
      },
      additionalBehaviors: {
        // Don't cache index.html
        "index.html": {
          origin: origin,
          allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: new CachePolicy(this, 'helm-organizer-index-cache-policy', {
            minTtl: Duration.seconds(0),
            maxTtl: Duration.seconds(0),
            defaultTtl: Duration.seconds(0)

          }),
          cachedMethods: CachedMethods.CACHE_GET_HEAD_OPTIONS,
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS
        }
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403, // S3 API returns 403 instead of 404 for missing files, so we need to return 200 here and allow angular's router to do its thing
          responseHttpStatus: 200,
          responsePagePath: '/index.html'
        },
        {
          httpStatus: 404, // S3 API returns 403 instead of 404 for missing files, so we need to return 200 here and allow angular's router to do its thing
          responseHttpStatus: 200,
          responsePagePath: '/index.html'
        },
        {
          httpStatus: 500,
          responsePagePath: '/index.html'
        }
      ]
    });
    cdn.node.addDependency(indexUpload);
    publicHostedZone !== undefined ? new ARecord(this, 'helm-organizer-frontend-dns-record', {
      target: RecordTarget.fromAlias(new CloudFrontTarget(cdn)),
      zone: publicHostedZone
    }) : console.log('No public hosted zone defined, skipping DNS record creation');

    // Outputs
    new CfnOutput(this, 'SiteBucket', {
     value: siteBucket.bucketName,
     description: 'Bucket where static assets are uploaded',
    })

    new CfnOutput(this, 'CdnDomainName', {
      value: cdn.domainName,
      description: 'Domain name for the CloudFront distribution (to access the site without a custom URL)',
     })

     new CfnOutput(this, 'DomainName', {
      value: publicHostedZone?.zoneName || cdn.domainName,
      description: 'Domain name for the site',
     })

     new CfnOutput(this, 'LogBucket', {
      value: logsBucket.bucketName,
      description: 'Domain name for the site',
     })
  }
}