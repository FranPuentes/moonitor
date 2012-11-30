
clean:
	find . -name \*~ -delete

pull:
	git pull

commit: clean
	git commit -a

tgz:
	tar czvf moon-broker.tgz broker moon-broker.js common modules
	tar czvf moon-daemon.tgz daemon moon-daemon.js common plugins

push: tgz commit
	git push

