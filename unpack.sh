#!/usr/bin/env shell

CURL=/usr/bin/curl

ENDPOINT="$1"
PACKAGE_NAME="$2"
CACHED_PATH="$3"
EXPECT_CHECKSUM="$4"
TIMEOUT="$5"

DOWNLOAD_URI="${ENDPOINT}/${PACKAGE_NAME}.tgz"
TMP_SAVED_PATH="/tmp/${PACKAGE_NAME}.tgz"
TMP_UNZIP_PATH="/tmp/${PACKAGE_NAME}.tar"

rm -rf ${CACHED_PATH}
rm -rf ${TMP_SAVED_PATH}
rm -rf ${TMP_UNZIP_PATH}
mkdir -p ${CACHED_PATH}

echo "downloading ${DOWNLOAD_URI} >> ${TMP_SAVED_PATH}"
$CURL -m ${TIMEOUT} -o ${TMP_SAVED_PATH} -k ${DOWNLOAD_URI}
CURL_ERROR=$?
if [ ${CURL_ERROR} -ne 0]; then
  echo "curl download resource failed with error code ${CURL_ERROR}"
  exit 1
fi
SUM_FULL=$(md5sum ${TMP_SAVED_PATH})
ACTUAL_CHECKSUM=${SUM_FULL:0:6}

echo "========================"
echo "full: $SUM_FULL"
echo "actual: $ACTUAL_CHECKSUM"
echo "expect: $EXPECT_CHECKSUM"
echo "========================"

if [ "$ACTUAL_CHECKSUM" != "$EXPECT_CHECKSUM" ]; then
echo "checking md5 failed expect ${EXPECT_CHECKSUM} but ${ACTUAL_CHECKSUM}"
rm -rf ${TMP_SAVED_PATH}
exit 1
fi

rm -rf ${TMP_UNZIP_PATH}
gzip -d ${TMP_SAVED_PATH} &&\
  tar -xf ${TMP_UNZIP_PATH} -C ${CACHED_PATH}

echo "Successfully downloaded"

# clean tmp
# rm -rf ${TMP_SAVED_PATH}
# rm -rf ${TMP_UNZIP_PATH}
